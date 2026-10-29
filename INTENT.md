# Project intent

## What this is

A class project. The goal is a small API that exposes the student-facing data of the SENAI Portal do Aluno (`https://senaiweb6.fieb.org.br`) as JSON, so a student can read their own information in a cleaner interface.

The API should behave like the portal's own frontend: same endpoints, same kind of requests, at a normal rate.

## Who it is for

The student who owns the account (the project author). It is not for other students, and it does not read anyone else's data.

## Permission and boundaries

- The project author has the teacher's permission for this class project.
- Only the author's own account is used for testing.
- The API should only use endpoints the frontend itself calls, and only read data the logged-in student can already see in the portal.

## What the project will not do

- **No payment or card endpoints.** These handle payment data and are out of scope for a read-only API.
- **No writes.** No changing passwords, profile data, enrollments, or payment state.
- **No guessed IDs or enumeration.** IDs come from the portal's own responses (for example, the current-user response), never from trying numbers in a sequence.
- **No credentials in code or files.** Passwords and tokens are read from environment variables or prompted at runtime, and are never committed or logged.
- **No bypassing access controls.** If the portal refuses a request, the API reports the refusal. It does not retry with other methods or tokens.
- **No hardcoded portal client secret.** The frontend's client credential is visible in public JavaScript. The API should take it from configuration, not embed it.

## How the API will behave

- Hold the session in memory. Do not write tokens to disk.
- Keep request volume close to what one student's browser would make.
- Mask personal values (name, CPF, address, contact details) in logs and examples.

## Related files

- [ENDPOINTS.md](ENDPOINTS.md): the endpoint map, tested responses, and open questions.
