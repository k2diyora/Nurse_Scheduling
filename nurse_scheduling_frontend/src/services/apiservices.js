const BASE_URL =
  process.env.REACT_APP_API_BASE_URL?.trim() || "/api";

async function apiFetch(path, options = {}) {
  const token = sessionStorage.getItem("token");
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error [${response.status}] ${path}: ${errorText}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

function nurseToUser(nurse) {
  return {
    id: String(nurse.ID ?? nurse.id),
    name: nurse.name,
    role: "nurse",
    specialty: Array.isArray(nurse.skills) ? nurse.skills.join(", ") : "",
    available: nurse.available ?? true,
    assignedPatients: nurse.assignedPatients,
    _raw: nurse,
  };
}

// function requestToTask(req) {
//   const shiftDate = req.shift_date ? new Date(req.shift_date) : null;
//   const timeStr = shiftDate
//     ? shiftDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
//     : "TBD";

//   const skills = Array.isArray(req.required_skills)
//     ? req.required_skills.join(", ")
//     : req.required_skills ?? "";

//   const completed =
//     req.completed ??
//     (typeof req.status === "string" ? req.status.toUpperCase() === "COMPLETED" : false);

//   return {
//     id: String(req.ID ?? req.id),
//     time: timeStr,
//     task: `${skills} — ${req.duration ?? "?"}h shift`,
//     completed,
//     status: req.status ?? (completed ? "COMPLETED" : "PENDING"),

//     patientId: String(req.patient_id),
//     patientName: `${req.patient_first_name ?? ""} ${req.patient_last_name ?? ""}`.trim() || "Unassigned",
//     shiftDate: req.shift_date,
//     duration: req.duration,
//     requiredSkills: req.required_skills,
//     _raw: req,
//   };
// }

function requestToClient(req) {
  return {
    id: req.ID,
    p_id: req.patient_id,
    name:
      `${req.patient_first_name ?? ""} ${req.patient_last_name ?? ""}`.trim() ||
      `Patient ${req.patient_id}`,
    status: req.status,
    role: "client",
    condition: Array.isArray(req.required_skills)
      ? req.required_skills.join(", ")
      : (req.required_skills ?? ""),
    _raw: req,
  };
}

class ApiDataService {
  async login(email, password) {
    try {
      const data = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      const token = data.token ?? data.access_token ?? data.jwt;
      if (!token) throw new Error("No token in login response");

      sessionStorage.setItem("token", token);

      const payloadB64 = token.split(".")[1];
      const payload = JSON.parse(
        atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")),
      );
      const role = payload.role ?? "nurse";
      const userEmail = payload.email ?? email;

      let user = {
        id: undefined,
        name: userEmail,
        email: userEmail,
        role,
      };

      if (role === "nurse") {
        try {
          const nurses = await apiFetch("/nurses");
          const matched =
            nurses.find(
              (n) =>
                n.email === userEmail ||
                n.name?.toLowerCase() === userEmail.split("@")[0].toLowerCase(),
            ) ?? nurses[0];

          if (matched) {
            const nurseUser = nurseToUser(matched);
            user = { ...nurseUser, email: userEmail, role };
          }
        } catch (err) {
          console.warn("Could not resolve nurse record after login:", err);
          user.id = String(payload.sub ?? payload.id ?? "nurse-unknown");
        }
      }

      sessionStorage.setItem("current_user", JSON.stringify(user));
      return user;
    } catch (err) {
      console.error("Login failed:", err);
      return null;
    }
  }

  setToken(token) {
    sessionStorage.setItem("token", token);
  }

  logout() {
    sessionStorage.removeItem("current_user");
    sessionStorage.removeItem("token");
  }

  getCurrentUser() {
    return JSON.parse(sessionStorage.getItem("current_user"));
  }

  async getUsers() {
    const nurses = await apiFetch("/nurses");
    const scheduledRequests = await apiFetch("/shifts");

    return nurses.map((nurse) => {
      const assignedPatients = scheduledRequests
        .filter((shift) => shift.nurse_id === nurse.ID)
        .map((shift) => shift.request_id);

      return {
        ...nurseToUser(nurse),
        assignedPatients: assignedPatients,
      };
    });
  }

  async getUsersByRole(role) {
    if (role === "nurse") {
      return this.getUsers();
    }
    if (role === "client") {
      const requests = await apiFetch("/requests");
      const seen = new Set();
      return requests
        .filter((r) => {
          if (!r.patient_id || seen.has(r.patient_id)) return false;
          seen.add(r.patient_id);
          return true;
        })
        .map(requestToClient);
    }
    return [];
  }

  //   async getScheduleForClient(clientId) {
  //     const requests = await apiFetch("/requests");
  //     const numericId = String(clientId).replace("patient-", "");
  //     return requests
  //       .filter((r) => String(r.patient_id) === numericId)
  //       .map(requestToTask);
  //   }

  //   async toggleScheduleItem(clientId, itemId) {
  //     const requests = await apiFetch("/requests");
  //     // Backend uses uppercase ID
  //     const req = requests.find(
  //       (r) => String(r.ID ?? r.id) === String(itemId),
  //     );
  //     if (!req) throw new Error(`Request ${itemId} not found`);

  //     const currentlyCompleted =
  //       typeof req.status === "string"
  //         ? req.status.toUpperCase() === "COMPLETED"
  //         : req.completed ?? false;

  //     const newStatus = currentlyCompleted ? "PENDING" : "COMPLETED";

  //     const updated = await apiFetch(`/requests/${itemId}`, {
  //       method: "PATCH",
  //       body: JSON.stringify({ status: newStatus }),
  //     });
  //     return requestToTask(updated);
  //   }

  async getClientsForNurse(nurseIdentity) {
    try {
      const [scheduledShifts, nurses, requests] = await Promise.all([
        apiFetch("/shifts"),
        apiFetch("/nurses"),
        apiFetch("/requests"),
      ]);

      const fullName =
        nurseIdentity?.name ||
        [nurseIdentity?.firstName, nurseIdentity?.lastName]
          .filter(Boolean)
          .join(" ")
          .trim();

      const nurseRecord = nurses.find((n) => {
        const nurseId = String(n.ID ?? n.id);
        const inputId = String(nurseIdentity?.id ?? "");
        const byId = inputId && nurseId === inputId;
        const byName =
          fullName &&
          String(n.name || "").toLowerCase() === fullName.toLowerCase();
        const byEmail =
          nurseIdentity?.email &&
          String(n.email || "").toLowerCase() ===
            String(nurseIdentity.email).toLowerCase();
        return byId || byName || byEmail;
      });

      if (!nurseRecord) {
        console.warn("getClientsForNurse: nurse record not found", nurseIdentity);
        return [];
      }

      const nurseId = String(nurseRecord.ID ?? nurseRecord.id);
      const assignedRequestIds = new Set(
        scheduledShifts
          .filter((shift) => String(shift.nurse_id) === nurseId)
          .map((shift) => String(shift.request_id)),
      );

      return requests
        .filter((request) => assignedRequestIds.has(String(request.ID ?? request.id)))
        .map(requestToClient);
    } catch (err) {
      console.error("getClientsForNurse error:", err);
      return [];
    }
  }

  async createNurse(nurse) {
    return apiFetch("/nurses", {
      method: "POST",
      body: JSON.stringify(nurse),
    });
  }

  async updateNurse(id, nurse) {
    return apiFetch(`/nurses/${id}`, {
      method: "PUT",
      body: JSON.stringify(nurse),
    });
  }

  async deleteNurse(id) {
    return apiFetch(`/nurses/${id}`, {
      method: "DELETE",
    });
  }

  async createRequest(request) {
    return apiFetch("/requests", {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  async updateRequest(id, request) {
    return apiFetch(`/requests/${id}`, {
      method: "PUT",
      body: JSON.stringify(request),
    });
  }

  async deleteRequest(id) {
    return apiFetch(`/requests/${id}`, {
      method: "DELETE",
    });
  }

  async getShifts() {
    return apiFetch("/shifts");
  }

  async getRequests() {
    return apiFetch("/requests");
  }
}

export const mockDataService = new ApiDataService();
