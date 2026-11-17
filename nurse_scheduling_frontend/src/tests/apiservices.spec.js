import { mockDataService } from "../services/apiservices";

describe("apiservices", () => {
  let consoleErrorSpy;
  let consoleWarnSpy;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.clearAllMocks();
    sessionStorage.clear();
    global.atob = (input) =>
      Buffer.from(input, "base64").toString("binary");
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  test("getRequests calls /requests with auth header", async () => {
    sessionStorage.setItem("token", "abc");
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    });

    await mockDataService.getRequests();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/requests"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer abc",
        }),
      }),
    );
  });

  test("create/update/delete request methods call expected endpoints", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });

    await mockDataService.createRequest({ a: 1 });
    await mockDataService.updateRequest(12, { b: 2 });
    await mockDataService.deleteRequest(12);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/requests"),
      expect.objectContaining({ method: "POST" }),
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/requests/12"),
      expect.objectContaining({ method: "PUT" }),
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/requests/12"),
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  test("create/update/delete nurse methods call expected endpoints", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });

    await mockDataService.createNurse({ name: "A" });
    await mockDataService.updateNurse(3, { name: "B" });
    await mockDataService.deleteNurse(3);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/nurses"),
      expect.objectContaining({ method: "POST" }),
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/nurses/3"),
      expect.objectContaining({ method: "PUT" }),
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/nurses/3"),
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  test("login returns null when auth response has no token", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ role: "nurse" }),
    });

    const result = await mockDataService.login("x@y.com", "secret");
    expect(result).toBeNull();
  });

  test("login resolves nurse user and stores current user", async () => {
    const jwtPayload = Buffer.from(
      JSON.stringify({ role: "nurse", email: "nurse@hospital.com", sub: "1" }),
      "binary",
    ).toString("base64");
    const token = `aaa.${jwtPayload}.bbb`;

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ token }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [{ ID: 1, name: "nurse", skills: ["ICU"] }],
      });

    const result = await mockDataService.login("nurse@hospital.com", "secret");

    expect(result).toEqual(expect.objectContaining({ role: "nurse" }));
    expect(sessionStorage.getItem("current_user")).toBeTruthy();
  });

  test("getUsersByRole client and fallback branches", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [
        {
          ID: 1,
          patient_id: 10,
          patient_first_name: "A",
          patient_last_name: "B",
          required_skills: ["ICU"],
          status: "PENDING",
        },
      ],
    });

    const clients = await mockDataService.getUsersByRole("client");
    const unknown = await mockDataService.getUsersByRole("other");

    expect(clients.length).toBe(1);
    expect(unknown).toEqual([]);
  });

  test("getUsersByRole nurse supports lowercase id and non-array skills", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [{ id: "x1", name: "Nurse X", skills: "ICU" }],
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [],
      });

    const nurses = await mockDataService.getUsersByRole("nurse");
    expect(nurses[0]).toEqual(
      expect.objectContaining({
        id: "x1",
        specialty: "",
        available: true,
      }),
    );
  });

  test("getUsersByRole client removes duplicates and missing patient ids", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [
        {
          ID: 1,
          patient_id: 10,
          patient_first_name: "A",
          patient_last_name: "B",
          required_skills: "ICU",
          status: "PENDING",
        },
        {
          ID: 2,
          patient_id: 10,
          required_skills: "ER",
          status: "PENDING",
        },
        {
          ID: 3,
          patient_id: null,
          status: "PENDING",
        },
      ],
    });

    const clients = await mockDataService.getUsersByRole("client");
    expect(clients).toHaveLength(1);
    expect(clients[0]).toEqual(
      expect.objectContaining({
        p_id: 10,
        name: "A B",
        condition: "ICU",
      }),
    );
  });

  test("getRequests throws with response error text", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "boom",
    });

    await expect(mockDataService.getRequests()).rejects.toThrow(
      "API Error [500] /requests: boom",
    );
  });

  test("deleteRequest accepts 204 no-content responses", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 204,
      text: async () => "",
    });

    const result = await mockDataService.deleteRequest(9);
    expect(result).toBeNull();
  });

  test("login supports non-nurse role and access_token", async () => {
    const jwtPayload = Buffer.from(
      JSON.stringify({ role: "admin", email: "admin@hospital.com", id: "55" }),
      "binary",
    ).toString("base64");
    const token = `aaa.${jwtPayload}.bbb`;

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ access_token: token }),
    });

    const result = await mockDataService.login("admin@hospital.com", "secret");

    expect(result).toEqual(
      expect.objectContaining({
        role: "admin",
        email: "admin@hospital.com",
      }),
    );
  });

  test("login for nurse falls back to first nurse when no direct match", async () => {
    const jwtPayload = Buffer.from(
      JSON.stringify({ role: "nurse", email: "someone@hospital.com", sub: "8" }),
      "binary",
    ).toString("base64");
    const token = `aaa.${jwtPayload}.bbb`;

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ token }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [
          { ID: 22, name: "first", skills: ["ICU"], available: false },
        ],
      });

    const result = await mockDataService.login("someone@hospital.com", "secret");
    expect(result).toEqual(
      expect.objectContaining({
        id: "22",
        role: "nurse",
        specialty: "ICU",
      }),
    );
  });

  test("login nurse keeps email user when nurses list is empty", async () => {
    const jwtPayload = Buffer.from(
      JSON.stringify({ role: "nurse", email: "empty@hospital.com", sub: "8" }),
      "binary",
    ).toString("base64");
    const token = `aaa.${jwtPayload}.bbb`;

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ token }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [],
      });

    const result = await mockDataService.login("empty@hospital.com", "secret");
    expect(result).toEqual(
      expect.objectContaining({
        name: "empty@hospital.com",
        email: "empty@hospital.com",
        role: "nurse",
      }),
    );
  });

  test("login uses default nurse role and email fallback from argument", async () => {
    const jwtPayload = Buffer.from(JSON.stringify({ id: "44" }), "binary").toString(
      "base64",
    );
    const token = `aaa.${jwtPayload}.bbb`;

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ token }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [{ ID: 44, name: "fallback", skills: [] }],
      });

    const result = await mockDataService.login("fallback@hospital.com", "secret");
    expect(result).toEqual(
      expect.objectContaining({
        role: "nurse",
        email: "fallback@hospital.com",
      }),
    );
  });

  test("login nurse resolves unknown id when nurse lookup fails", async () => {
    const jwtPayload = Buffer.from(
      JSON.stringify({ role: "nurse", email: "n2@hospital.com", sub: "77" }),
      "binary",
    ).toString("base64");
    const token = `aaa.${jwtPayload}.bbb`;

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ jwt: token }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => "missing",
      });

    const result = await mockDataService.login("n2@hospital.com", "secret");
    expect(result).toEqual(
      expect.objectContaining({
        role: "nurse",
        id: "77",
      }),
    );
  });

  test("login nurse uses nurse-unknown fallback when payload has no sub/id", async () => {
    const jwtPayload = Buffer.from(
      JSON.stringify({ role: "nurse", email: "n3@hospital.com" }),
      "binary",
    ).toString("base64");
    const token = `aaa.${jwtPayload}.bbb`;

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ jwt: token }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "missing",
      });

    const result = await mockDataService.login("n3@hospital.com", "secret");
    expect(result).toEqual(
      expect.objectContaining({
        role: "nurse",
        id: "nurse-unknown",
      }),
    );
  });

  test("getUsers maps assigned patients from shifts", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [
          { ID: 1, name: "A", skills: ["IV"], available: true },
          { ID: 2, name: "B", skills: ["ICU"], available: false },
        ],
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [
          { nurse_id: 1, request_id: 10 },
          { nurse_id: 1, request_id: 11 },
          { nurse_id: 2, request_id: 12 },
        ],
      });

    const users = await mockDataService.getUsers();
    expect(users[0]).toEqual(
      expect.objectContaining({
        id: "1",
        assignedPatients: [10, 11],
      }),
    );
    expect(users[1]).toEqual(
      expect.objectContaining({
        id: "2",
        assignedPatients: [12],
      }),
    );
  });

  test("getUsersByRole nurse returns transformed users", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [{ ID: 5, name: "Nurse Five", skills: ["ICU"] }],
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [{ nurse_id: 5, request_id: 42 }],
      });

    const nurses = await mockDataService.getUsersByRole("nurse");
    expect(nurses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "5", assignedPatients: [42] }),
      ]),
    );
  });

  test("getClientsForNurse returns assigned request-derived clients", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [{ nurse_id: 5, request_id: 12 }],
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [{ ID: 5, name: "N5" }],
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [
          {
            ID: 12,
            patient_id: 200,
            patient_first_name: "Pa",
            patient_last_name: "Ti",
            required_skills: ["ICU"],
            status: "PENDING",
          },
        ],
      });

    const clients = await mockDataService.getClientsForNurse({
      id: 5,
      name: "N5",
    });
    expect(clients).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ p_id: 200, role: "client" }),
      ]),
    );
  });

  test("getClientsForNurse matches by name and filters assigned ids", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [
          { nurse_id: 6, request_id: 10 },
          { nurse_id: 6, request_id: 11 },
        ],
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [{ ID: 6, name: "Jane Doe", email: "jd@h.com" }],
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [
          { ID: 10, patient_id: 500, patient_first_name: "A", patient_last_name: "B", required_skills: "ICU", status: "PENDING" },
          { ID: 12, patient_id: 501, patient_first_name: "X", patient_last_name: "Y", required_skills: ["ER"], status: "PENDING" },
        ],
      });

    const clients = await mockDataService.getClientsForNurse({
      firstName: "Jane",
      lastName: "Doe",
    });
    expect(clients).toHaveLength(1);
    expect(clients[0]).toEqual(expect.objectContaining({ p_id: 500, condition: "ICU" }));
  });

  test("getClientsForNurse matches by email and supports lowercase ids", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [{ nurse_id: "a1", request_id: "r2" }],
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [{ id: "a1", name: "N", email: "n@h.com" }],
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [{ id: "r2", patient_id: 321, status: "PENDING" }],
      });

    const clients = await mockDataService.getClientsForNurse({ email: "n@h.com" });
    expect(clients).toHaveLength(1);
    expect(clients[0]).toEqual(
      expect.objectContaining({
        p_id: 321,
        name: "Patient 321",
      }),
    );
  });

  test("getClientsForNurse returns empty when nurse record is not found", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [{ nurse_id: 2, request_id: 10 }],
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [{ ID: 2, name: "Someone Else" }],
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [{ ID: 10, patient_id: 100, status: "PENDING" }],
      });

    const clients = await mockDataService.getClientsForNurse({
      id: 99,
      name: "Missing Nurse",
      email: "missing@nurse.internal",
    });

    expect(consoleWarnSpy).toHaveBeenCalled();
    expect(clients).toEqual([]);
  });

  test("getClientsForNurse returns empty array on failure", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("network"));
    const clients = await mockDataService.getClientsForNurse({ id: 5 });
    expect(clients).toEqual([]);
  });

  test("getClientsForNurse with missing name triggers warning path", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const clients = await mockDataService.getClientsForNurse(undefined);
    expect(errorSpy).toHaveBeenCalled();
    expect(clients).toEqual([]);
    errorSpy.mockRestore();
  });

  test("getClientsForNurse matches by direct name string", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [{ nurse_id: 7, request_id: 88 }],
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [{ ID: 7, name: "Name Match" }],
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [{ ID: 88, patient_id: 111, status: "PENDING" }],
      });

    const clients = await mockDataService.getClientsForNurse({ name: "name match" });
    expect(clients).toHaveLength(1);
    expect(clients[0]).toEqual(expect.objectContaining({ p_id: 111 }));
  });

  test("token and current user helpers", () => {
    mockDataService.setToken("zzz");
    sessionStorage.setItem("current_user", JSON.stringify({ id: "1" }));

    expect(sessionStorage.getItem("token")).toBe("zzz");
    expect(mockDataService.getCurrentUser()).toEqual({ id: "1" });

    mockDataService.logout();
    expect(sessionStorage.getItem("token")).toBeNull();
    expect(sessionStorage.getItem("current_user")).toBeNull();
  });

  test("getShifts calls /shifts endpoint", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{ ID: 1 }],
    });

    const shifts = await mockDataService.getShifts();
    expect(shifts).toEqual([{ ID: 1 }]);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/shifts"),
      expect.objectContaining({
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      }),
    );
  });

  test("uses trimmed API base url from environment when provided", async () => {
    const previousBaseUrl = process.env.REACT_APP_API_BASE_URL;
    process.env.REACT_APP_API_BASE_URL = "  /custom-api  ";

    jest.resetModules();
    let isolatedService;
    jest.isolateModules(() => {
      isolatedService = require("../services/apiservices").mockDataService;
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    });

    await isolatedService.getRequests();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/custom-api/requests"),
      expect.any(Object),
    );

    process.env.REACT_APP_API_BASE_URL = previousBaseUrl;
    jest.resetModules();
  });
});
