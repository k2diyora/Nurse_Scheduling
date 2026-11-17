package models

// RequestStatus represents the scheduling state of a client request
type RequestStatus string

const (
	StatusPending   RequestStatus = "PENDING"
	StatusAssigned  RequestStatus = "ASSIGNED"
	StatusCompleted RequestStatus = "COMPLETED"
	StatusCancelled RequestStatus = "CANCELLED"
)
