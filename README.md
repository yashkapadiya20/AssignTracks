# Student Assignment Tracker

A web app where teachers create classes and assignments, set deadlines, review submissions, and give marks and feedback. Students join classes with a class code, turn in work (text and/or a PDF or Word file), and track status and feedback from one dashboard.

## Features

**Students**
- Dashboard with Assigned / Missing / Turned in counts, average grade, "Due soon" and "Recent grades"
- To-do page with **Assigned / Missing / Done** tabs, search and class filter, sorted by deadline
- Join a class with a 7-character class code
- Assignment view: instructions, countdown, turn in / edit / unsubmit (until graded), grade and feedback
- Attach a **PDF, DOC or DOCX** file (up to 10 MB) to a submission
- Work turned in after the deadline is flagged **Late**

**Teachers**
- Dashboard with classes, students, assignments and "waiting to grade" counts
- Create classes (a class code is generated), with Classwork and People tabs
- Create, edit and delete assignments (title, instructions, deadline, points)
- **Student work** page per assignment: every student grouped as Turned in / Graded / Pending (including Missing), class average, and marks and feedback entry
- Preview or download attached files in the browser
- "To review" page: Needs grading / Upcoming / Past due tabs

**General:** light and dark mode, mobile-friendly layout, toast notifications, confirmation before deleting.

- **Frontend:** React (Vite) in `client/`
- **Backend:** Node.js + Express REST API in `server/`
- **Database:** PostgreSQL (or a built-in in-memory Postgres when no database is configured)
- **File uploads:** multer, stored on disk in `server/uploads/` (git-ignored)
- **CI/CD:** GitHub Actions runs the API tests and builds the client on every push or PR to `main`, then deploys `main` to AWS EC2
- **Hosting:** Ubuntu on EC2, Apache reverse proxy, PM2 process manager

## Run locally

Requires Node.js 22+.

```bash
# Terminal 1: API on http://localhost:4000
cd server
npm install
npm run dev

# Terminal 2: React app on http://localhost:5173 (proxies /api to the server)
cd client
npm install
npm run dev
```

Open http://localhost:5173, register one **teacher** and one **student** account (use two browsers or an incognito window), and try the flow:

1. Teacher: **Create class**, then copy the class code.
2. Teacher: open the class, then **Create assignment**.
3. Student: **Join class** with the code, open **To-do**, then click the assignment and **Turn in**.
4. Teacher: **To review**, open the assignment, pick the student, then enter marks and feedback.
5. Student: the work moves to **Done** and shows the grade and feedback.

### Single-process mode

```bash
cd client && npm run build
cd ../server && npm start   # serves the built app and the API at http://localhost:4000
```

## Database

| `DATABASE_URL` | Behaviour |
| --- | --- |
| not set | In-memory Postgres (`pg-mem`). No install needed; data resets on restart. |
| set, e.g. `postgres://user:pass@localhost:5432/tracker` | Real PostgreSQL. Tables are created automatically on startup (see `server/src/schema.sql`). |

The easiest way to set it is a `server/.env` file (copy `server/.env.example`). It is read automatically on startup and is git-ignored, so your password is never committed. The first startup line tells you which database is in use.

Set `JWT_SECRET` to a long random string for anything beyond local testing. With `NODE_ENV=production` the server refuses to start unless both `DATABASE_URL` and `JWT_SECRET` are set.

Uploaded files are saved in `server/uploads/` (or `UPLOAD_DIR`) under random names; the original name is stored in the database.

## Tests

```bash
cd server && npm test
```

The tests cover registration and login, role checks, courses and enrollment, assignment creation, submission and resubmission, file uploads and downloads, grading and status tracking. They use the in-memory database, so no database or cloud setup is required.

## API

| Method | Path | Role | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | any | Create an account (`role`: teacher or student) |
| POST | `/api/auth/login` | any | Get a JWT |
| GET | `/api/auth/me` | any | Current user |
| GET | `/api/courses` | any | Teacher: classes taught. Student: classes joined. Includes student and assignment counts |
| GET | `/api/courses/:id` | member | Class details and student roster |
| POST | `/api/courses` | teacher | Create a class (a class `code` is generated) |
| POST | `/api/courses/join` | student | Join a class by `code` |
| GET | `/api/assignments?course_id=` | any | Teacher: with student, turned-in and graded counts. Student: with own submission, `status` and `late` |
| GET | `/api/assignments/:id` | member | One assignment (same shape as the list) |
| POST | `/api/assignments` | teacher | Create (`course_id`, `title`, `description`, `due_date`, `max_marks`) |
| PUT | `/api/assignments/:id` | teacher | Edit an assignment |
| DELETE | `/api/assignments/:id` | teacher | Delete an assignment and its submissions |
| GET | `/api/assignments/:id/submissions` | teacher | Every enrolled student with their submission and status |
| POST | `/api/assignments/:id/submissions` | student | Turn in or update work (until graded). JSON or multipart: `content`, optional `file`, `remove_file` |
| DELETE | `/api/assignments/:id/submissions` | student | Unsubmit (until graded) |
| PUT | `/api/submissions/:id/grade` | teacher | Set `marks` and `feedback` |
| GET | `/api/submissions/:id/file` | owner or teacher | Download the attached file |

Student status is one of `assigned` (not due yet), `missing` (past due, nothing turned in), `submitted` (turned in) or `graded`.

## Deployment (AWS EC2)

```
Browser ──► Apache :80 ──► Node/Express :4000 (PM2) ──► PostgreSQL :5432
                               ├─ serves client/dist
                               └─ server/uploads/
```

### One-time server setup (Ubuntu 24.04)

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git postgresql apache2
sudo npm install -g pm2

sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'ChooseAStrongPassword';"
sudo -u postgres createdb tracker

git clone https://github.com/yashkapadiya20/AssignTracks.git ~/AssignTrack
cd ~/AssignTrack/client && npm ci && npm run build
cd ~/AssignTrack/server && npm ci --omit=dev
cp .env.example .env && nano .env      # DATABASE_URL (port 5432), JWT_SECRET

NODE_ENV=production pm2 start src/index.js --name assigntrack
pm2 save && pm2 startup                # run the command it prints
```

Apache (`/etc/apache2/sites-available/assigntrack.conf`):

```apache
<VirtualHost *:80>
    ProxyPreserveHost On
    ProxyPass / http://localhost:4000/
    ProxyPassReverse / http://localhost:4000/
</VirtualHost>
```

```bash
sudo a2enmod proxy proxy_http
sudo a2dissite 000-default && sudo a2ensite assigntrack
sudo systemctl reload apache2
```

EC2 security group: allow HTTP (80) and SSH (22). SSH must be open to GitHub Actions for automatic deploys.

### Continuous deployment

`.github/workflows/ci.yml` deploys every push to `main` once the tests and client build pass. It connects over SSH, runs `git reset --hard origin/main`, rebuilds the client, installs server packages, restarts PM2 and checks `/api/health`. `server/.env` and `server/uploads/` are git-ignored, so deploys never touch settings or uploaded files.

Repository secrets (Settings → Secrets and variables → Actions):

| Secret | Value |
| --- | --- |
| `EC2_HOST` | Public IP (use an Elastic IP so it does not change) |
| `EC2_USER` | `ubuntu` |
| `EC2_SSH_KEY` | Private SSH key that can log in to the server |

A deploy can also be started by hand from **Actions → CI → Run workflow**.

### Backups

Data lives in the `tracker` database and `server/uploads/`:

```bash
pg_dump -U postgres -h localhost tracker > tracker-backup.sql
tar czf uploads-backup.tgz -C ~/AssignTrack/server uploads
```
