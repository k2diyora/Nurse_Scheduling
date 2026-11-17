## Every day the scheduler will check which patient requests have shift date as present day, and then assign a nurse that is available and has required skills.

## steps:
1. go to the nurse_scheduling_backend directory
2. start docker desktop application
3. start mysql using - docker compose up -d
4. set go environmet variables -> export DB_USER=user export DB_PASS=pass export DB_HOST=127.0.0.1 export DB_PORT=3306 export DB_NAME=db
5. run go server - go run cmd/server/main.go

## How to test?
1. create a nurse-
curl -X POST http://localhost:8080/nurses \
-H "Content-Type: application/json" \
-d '{"name":"Mansi","skills":["ICU","ER"],"available":true}'

2. create a request-
curl -X POST http://localhost:8080/requests \
-H "Content-Type: application/json" \
-d '{
  "patient_id": 1,
  "patient_first_name": "Mansi2",
  "patient_last_name": "Bhalerao2",
  "required_skills": ["ICU"],
  "shift_date": "2026-03-02T12:00:00-05:00",
  "duration": 8
}'

3. The autoscheduler will assign this request to the nurse "Mansi", you can verify by opening MySql shell into running docker container and query mysql database.

### After assigning nurse to patient the scheduler will notify - 
##### "Notification: Nurse 1 assigned to Request 1"

### To run unit tests
in the main directory run -> 
go test -count=1 ./internal/handlers ./internal/services ./internal/models -covermode=atomic -coverprofile=coverage.out && go tool cover -func=coverage.out | tail -n 1
go tool cover -html=coverage.out

the above command will also open a html page, showing in red and green lines as not covered by tests and covered by tests respectively.

## How to test, auth enabled?
1. Register
curl -X POST http://localhost:8080/api/register \
-H "Content-Type: application/json" \
-d '{
  "firstName": "mansi",
  "lastName": "bhalerao",
  "email": "mansi@example.com",
  "password": "password123",
  "role": "admin"
}'
2. Get JWT token
3. Use that token in Authorization header
curl -X POST http://localhost:8080/api/requests \
-H "Content-Type: application/json" \
-H "Authorization: Bearer YOUR_TOKEN_HERE" \
-d '{
  "patient_id": 1,
  "patient_first_name": "Alice",
  "patient_last_name": "Smith",
  "required_skills": ["ICU"],
  "shift_date": "2026-03-02T12:00:00-05:00",
  "duration": 8
}'
4. for get request
curl -X GET http://localhost:8080/api/requests \
-H "Authorization: Bearer YOUR_TOKEN_HERE"