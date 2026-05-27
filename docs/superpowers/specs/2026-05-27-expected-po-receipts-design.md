# Expected PO Receipts — Design

**Datum:** 2026-05-27
**Status:** Approved (brainstorming)
**Sledeći korak:** writing-plans → implementation

## 1. Cilj

Web aplikacija (responsive desktop + mobile) koja olakšava magacionerima planiranje i obradu očekivanih prijema iz nabavnih porudžbenica (POs) u DELMIAWORKS ERP-u.

**Dva korisnička toka:**

1. **Planning (planer/nabavljač):** Unosi period (`dateFrom` + `dateTo` *ili* `dateFrom` + `nextDays`), pregleda otvorene PO release stavke grupisane po Promise Date, selektuje stavke, bira magacionera iz dropdown-a, klikne *Generate Expected POs* → kreira task.
2. **Receiving (magacioner):** Otvara link iz email-a / in-app notifikacije, loguje se DW kredencijalima, vidi listu otvorenih task-ova, otvara konkretan task, unosi *Lot No*, *Qty Received*, *Location* po stavki, klikne *Receive* → stavka se primi u DW + odštampa nalepnica za punu količinu prijema.

**Što JE u opsegu:**

- Login (DW kredencijali, EPlant izbor)
- Planning ekran sa filterom datuma + lista grupisanih PO release stavki
- Generisanje task-a + slanje email + in-app (SSE) notifikacije
- Receiving lista task-ova
- Per-item prijem: `CreatePOReceipt` → `PostPOReceiptAndUpdateMasterLabel` → `PrintPurchased`
- Status tracking task-a u SQLite
- Štampa label-a uvek za **punu primljenu količinu** (qty received), ne za delove

**Što NIJE:**

- Editovanje task-a posle generisanja (samo cancel)
- Inteligentno predlaganje magacionera po lokaciji
- Multi-language UI (samo engleski u v1)
- Offline mode
- Roles/permissions granular pristup (svako ulogovan može i da planira i da prima)

## 2. Tech stack

- **Backend:** Node.js 20+ / TypeScript / Express, axios klijent za DW WebAPI, `better-sqlite3` za SQLite, `nodemailer` za SMTP, `pino` za strukturisano logovanje.
- **Frontend:** React 18 / TypeScript / Vite, `TanStack Query` (server state), `Zustand` (local state), `React Router` (role-based rute).
- **Auth:** Isti pattern kao postojeća `delmiaworks-production-reporter` aplikacija — DW credentials login → backend čuva AuthToken u in-memory session mapi → frontend dobija httpOnly `sessionId` cookie.
- **Notifikacije:** Server-Sent Events (SSE) za in-app push, backup polling na svakih 60s; SMTP za email iz `.env` varijabli.
- **Deployment:** lokalno (jedna mašina, dva procesa u dev-u, jedan u produkciji), SQLite fajl na disku.
- **UI jezik:** engleski.
- **Verzioniranje:** monorepo (npm workspaces), repo `expected-po-receipts`.

## 3. Repo struktura

```
expected-po-receipts/
├── backend/
│   ├── src/
│   │   ├── server.ts                 # Express bootstrap, SSE setup
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── poReleases.ts
│   │   │   ├── tasks.ts
│   │   │   ├── receipts.ts
│   │   │   ├── employees.ts
│   │   │   ├── locations.ts
│   │   │   ├── printers.ts
│   │   │   └── notifications.ts      # SSE stream
│   │   ├── dwClient/
│   │   │   ├── index.ts              # createClient(baseUrl, creds)
│   │   │   ├── auth.ts
│   │   │   ├── http.ts
│   │   │   ├── filter.ts
│   │   │   ├── eplants.ts
│   │   │   ├── inventory.ts
│   │   │   ├── poReleases.ts         # NOVO
│   │   │   ├── poReceipts.ts         # NOVO
│   │   │   ├── labels.ts             # NOVO (PrintPurchased)
│   │   │   ├── employees.ts          # NOVO (TeamMember)
│   │   │   └── types.ts
│   │   ├── db/
│   │   │   ├── index.ts              # better-sqlite3 instanca
│   │   │   ├── migrations/
│   │   │   │   └── 001_init.sql
│   │   │   └── queries/
│   │   │       ├── tasks.ts
│   │   │       └── items.ts
│   │   ├── services/
│   │   │   ├── taskService.ts
│   │   │   ├── notificationService.ts
│   │   │   └── mailer.ts
│   │   ├── session.ts
│   │   ├── logger.ts
│   │   ├── middleware/
│   │   │   ├── auth.ts
│   │   │   └── error.ts
│   │   └── config.ts
│   ├── test/
│   │   ├── fixtures/dw/
│   │   └── ...
│   ├── package.json
│   ├── tsconfig.json
│   └── vitest.config.ts
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Planning.tsx
│   │   │   ├── Receiving.tsx
│   │   │   └── ReceivingTask.tsx
│   │   ├── components/
│   │   │   ├── DateRangePicker.tsx
│   │   │   ├── POReleaseTable.tsx
│   │   │   ├── TaskCard.tsx
│   │   │   ├── ReceiveItemForm.tsx
│   │   │   ├── NavHeader.tsx
│   │   │   └── PrinterPicker.tsx
│   │   ├── api/                      # tanki klijent za BFF
│   │   ├── store/                    # Zustand (session + selection)
│   │   ├── hooks/
│   │   │   └── useNotifications.ts   # SSE listener
│   │   ├── types.ts
│   │   └── styles.css
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
├── data/                              # SQLite fajl (gitignored)
├── docs/superpowers/specs/
├── .env.example
├── .gitignore
├── README.md
└── package.json                       # workspace root
```

## 4. Komponente

### 4.1 dwClient (backend)

Tanki sloj nad axiosom. Odgovornosti identične postojećoj `delmiaworks-production-reporter` aplikaciji — auth (`POST /User/Login`), AuthToken injection header, auto re-login na 403, `buildFilter` helper.

Moduli specifični za ovaj projekat:

**`poReleases.ts`** — `listOpenReleasesByPromiseDate(dateFrom, dateTo, eplantId)`:
1. DW `GET POReleaseItems` (ili odgovarajući endpoint) sa filterom `PromiseDate.between~dateFrom~dateTo~ & EPlantId.eq~{id}~`.
2. Za svaku release stavku: izračunaj `remaining = release.qty - sum(receipts.qtyReceived)` (poziva `POReceipts` ako DW ne vraća već).
3. Filtriraj `remaining > 0`.
4. Batch `GET Inventory` za jedinstvene `ArInvtId`-jeve (paralelno, dedup) → enrich sa `Class`, `ItemNo`, `Rev`, `Descrip`, `DefaultRecvDesignator`.
5. Group po `PromiseDate` (asc).
6. Vrati `[{ date: PromiseDate, items: POReleaseRow[] }]`.

**`poReceipts.ts`** — `createAndPostReceipt({ poDetailId, poReleaseId, qty, lotNo, locationId, useDefaultLocation, comment, username })`:
1. `POST POReceiving/PO/CreatePOReceipt/0` sa query parametrima → vraća `receiptId`.
2. `POST POReceiving/PO/PostPOReceiptAndUpdateMasterLabel/0?poReceiptId={receiptId}` sa body-jem `{ UseDefaultLocation, LocationId, LotNo, TransDate }`.
3. Vraća `{ receiptId, masterLabelId, postedAt }`.

**`labels.ts`** — `printPurchased({ masterLabelId, printerName, qty })`:
1. `POST Labels/PrintLabel/PrintPurchased/{masterLabelId}?printerName=...&sendToPrinter=true` sa body koji sadrži `qty` (puna primljena količina).
2. `GET Labels/PrintLabel/PrinterList/0` za dropdown printera.

**`employees.ts`** — `listTeamMembers()`:
1. `GET TimeAttendance/Employees/TeamMember/0`.
2. Vraća sve aktivne članove (`EmpStatus = 'Active'`).
3. UI filtrira/pretražuje po `JobDescription` ili ručno bira.

### 4.2 Session (backend)

In-memory `Map<sessionId, SessionData>`:

```typescript
type SessionData = {
  sessionId: string;        // UUID v4
  username: string;
  baseUrl: string;
  database: string;
  eplantId: number;
  authToken: string;
  badge: string;            // za audit / komentar na receipt
  email?: string;           // popunjen iz Employee odgovora
  passwordEnc: string;      // simetrično enkriptovano session ključem za re-login na 403
  createdAt: Date;
  lastActivityAt: Date;
};
```

- TTL: 8h od `lastActivityAt`. Periodična čistka svakih 15 min.
- Brisanje sesije na logout.
- Restart procesa briše sve sesije (prihvatljivo).

### 4.3 SQLite šema

`db/migrations/001_init.sql`:

```sql
CREATE TABLE expected_receipt_task (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_by_username TEXT NOT NULL,
  created_by_eplant_id INTEGER NOT NULL,
  assigned_to_employee_id INTEGER NOT NULL,   -- DW TeamMemberId / Employee Id
  assigned_to_username TEXT NOT NULL,         -- za query po session.username
  assigned_to_email TEXT,
  assigned_to_name TEXT,
  date_from TEXT NOT NULL,                    -- ISO date
  date_to TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',        -- open | in_progress | completed | cancelled
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  cancelled_at TEXT,
  notification_sent_at TEXT,
  notification_error TEXT
);

CREATE TABLE expected_receipt_item (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES expected_receipt_task(id) ON DELETE CASCADE,
  po_id INTEGER NOT NULL,
  po_no TEXT NOT NULL,
  po_detail_id INTEGER NOT NULL,
  po_release_id INTEGER NOT NULL,
  promise_date TEXT NOT NULL,                  -- ISO date
  ar_invt_id INTEGER NOT NULL,
  item_class TEXT,
  item_no TEXT NOT NULL,
  item_rev TEXT,
  item_description TEXT,
  qty_expected REAL NOT NULL,
  default_recv_designator TEXT,
  status TEXT NOT NULL DEFAULT 'pending',      -- pending | received | failed
  received_qty REAL,
  received_lot_no TEXT,
  received_location_id INTEGER,
  received_location_name TEXT,
  received_at TEXT,
  dw_receipt_id INTEGER,                       -- PO_RECEIPTS.ID
  dw_master_label_id INTEGER,
  label_printed INTEGER DEFAULT 0,             -- 0/1
  label_print_error TEXT,
  error_message TEXT
);

CREATE INDEX idx_task_assigned ON expected_receipt_task(assigned_to_username, status);
CREATE INDEX idx_task_created_by ON expected_receipt_task(created_by_username, created_at);
CREATE INDEX idx_item_task ON expected_receipt_item(task_id, status);
```

Migracije se izvršavaju idempotentno pri startup-u (tabela `schema_migrations` čuva primenjene verzije).

### 4.4 Services

**`taskService`:**
- `createTask({ createdBy, assignedTo, dateFrom, dateTo, items })` → transactionally insert task + items, trigger notification, return `taskId`.
- `listMyTasks(username)` → `SELECT WHERE assigned_to_username = ? AND status IN ('open','in_progress')`.
- `getTaskById(taskId, username)` → task + items, guard po assigned_to.
- `receiveItem(taskId, itemId, { lotNo, qty, locationId, printerName }, session)` → orchestracija DW poziva + DB update (vidi 5.2).
- `cancelTask(taskId, username)` → guard po creator-u, status = cancelled.

**`notificationService`:**
- `subscribe(username, res)` → registruje SSE konekciju u `Map<username, Response[]>`.
- `broadcast({ to, event, payload })` → piše SSE `event:<type>\ndata:<json>` svim subskriberima za korisnika.
- `unsubscribe(username, res)` → cleanup na disconnect.

**`mailer`:**
- `nodemailer.createTransport` iz `.env` (host, port, user, pass, from).
- `sendTaskCreated(toEmail, taskId, summary, taskUrl)` → HTML template, vraća `{ messageId }` ili throw-uje.
- Error se ne prosleđuje korisniku (task je već kreiran) — loguje se i pamti u `notification_error`.

### 4.5 BFF rute (backend)

Sve pod prefiksom `/api`, sve traže validan `sessionId` cookie (osim `/api/auth/login`).

| Metoda | Putanja | Opis |
|--------|---------|------|
| POST | `/api/auth/login` | `{ baseUrl, username, password, database, eplantId }` → set httpOnly cookie, vrati `{ username, eplantId, email }` |
| POST | `/api/auth/logout` | obriši sesiju |
| GET | `/api/auth/me` | trenutna sesija ili 401 |
| GET | `/api/po-releases?dateFrom=&dateTo=` | otvorene PO release stavke grupisane po PromiseDate |
| GET | `/api/employees` | lista zaposlenih (TeamMembers) za dropdown |
| GET | `/api/locations?arInvtId=` | lokacije gde se artikal može primiti |
| GET | `/api/printers` | lista DW printera |
| POST | `/api/tasks` | kreiraj task + pošalji email + SSE |
| GET | `/api/tasks?role=mine` | otvoreni task-ovi ulogovanog magacionera |
| GET | `/api/tasks/:id` | task + stavke |
| POST | `/api/tasks/:id/items/:itemId/receive` | obradi prijem jedne stavke |
| POST | `/api/tasks/:id/cancel` | otkaži task (samo creator) |
| GET | `/api/notifications/stream` | SSE event stream |

### 4.6 Wizard / Page UI (frontend)

**Rute (React Router):**

```
/login                  -> Login page
/                       -> redirect na /planning
/planning               -> Planning ekran (DateRange + PO Release table + Generate)
/receiving              -> Lista mojih open task-ova
/receiving/:taskId      -> Detalj task-a + per-item Receive forma
```

Header sa tab navigacijom (`Planning` | `Receiving`) + badge sa brojem otvorenih task-ova (live preko SSE).

**Planning page:**
- Date range toggle (range mode ili "next N days") u Zustand state, perzistirano u `localStorage`.
- Lista grupisana po PromiseDate, collapsable grupa (default expanded).
- Checkbox po stavci + master checkbox po datumu.
- Magacioner dropdown iz `/api/employees`.
- `Generate` disabled dok nisu selektovani >= 1 stavka i magacioner.
- Po klik → POST `/api/tasks` → toast + reset selekcije.

**Receiving list:**
- TanStack Query za `/api/tasks?role=mine`, refetch interval 60s + SSE invalidacija.
- Kartice po task-u sa summary informacijama.

**Receiving task detail:**
- Lista stavki sortirana po PromiseDate.
- Svaka stavka: collapsable form sa poljima `Lot No`, `Qty Received` (max = `qty_expected`), `Location` dropdown, `Printer` dropdown (default iz korisničkog setting-a u `localStorage`).
- Po `Receive`: POST endpoint → loading → success kolapsira formu + zelena oznaka, failure prikazuje detaljnu poruku + `Try again`.
- Kad sve stavke received → task auto-completed → success ekran.

**`useNotifications` hook:**
- Otvara SSE konekciju na `/api/notifications/stream` posle login-a.
- Na `event: new_task` → invalidira TanStack Query za `/api/tasks` + browser Notification (ako permission odobren).
- Auto-reconnect sa exponential backoff (1s, 2s, 4s, max 30s).

### 4.7 EPlant kontekst

- Korisnik bira EPlant na login formi (dropdown popunjava iz `eplants.ts`, fallback ručan unos).
- EPlant se čuva u sesiji.
- Backend automatski dodaje `EPlantId.eq~{sessionEplant}~` u filtere za PO Releases.
- Inventory itemsi su cross-plant, ne filtriraju se.

## 5. Data flow

### 5.1 Planning tok

```
1. User otvara /planning
2. Default vrednosti: dateFrom = today, dateTo = today + 14 days
3. Klik [Refresh] →
   GET /api/po-releases?dateFrom=2026-05-27&dateTo=2026-06-10
   Backend:
     a) DW GET POReleaseItems sa filterom PromiseDate range + EPlantId
     b) Za svaku release: izračunaj remaining = qty - sum(receipts.qtyReceived)
     c) Filtriraj remaining > 0
     d) Batch GET Inventory za ar_invt_id-jeve (paralelno, dedup)
     e) Group po PromiseDate (asc)
   Response: [{ date, items: [{ poReleaseId, poDetailId, poId, poNo, arInvtId, itemNo, rev, descrip, class, qty, defaultRecvDesignator }] }]
   TanStack Query keš: staleTime 30s
4. User selektuje stavke (Zustand selectionSet)
5. User bira magacionera iz dropdown-a
6. Klik [Generate Expected POs] →
   POST /api/tasks { assignedToEmployeeId, dateFrom, dateTo, items: [...] }
   Backend (transakcija):
     a) INSERT expected_receipt_task (status = open)
     b) INSERT expected_receipt_item rows (status = pending)
     c) mailer.sendTaskCreated(employeeEmail, taskUrl, summary)
     d) notificationService.broadcast({ to: employeeUsername, event: 'new_task', taskId })
     e) UPDATE notification_sent_at (ili notification_error)
   Response: { taskId, itemCount }
7. Frontend: toast + reset selekcije
```

### 5.2 Receiving tok

```
1. Magacioner dobija email sa linkom http://host:5173/receiving/12
2. Klik → ako ulogovan vodi na detalj, inače /login pa redirect
3. /receiving lista →
   GET /api/tasks?role=mine
   Backend: SELECT iz SQLite WHERE assigned_to_username = session.username AND status IN ('open','in_progress')
4. Klik na task → /receiving/12
   GET /api/tasks/12
   Backend: SELECT task + JOIN items
5. Magacioner unosi lot/qty/location → klik [Receive] →
   POST /api/tasks/12/items/55/receive { lotNo, qty, locationId, printerName }
   Backend (sequential na DW, transactional na SQLite):
     a) Validate item.status === 'pending' (409 ako nije)
     b) Validate qty > 0 && qty <= item.qty_expected
     c) DW CreatePOReceipt(poDetailId, poReleaseId, qtyReceived=qty, dateReceived=now,
                           comment=`Task #12`, username=session.username) → receiptId
     d) DW PostPOReceiptAndUpdateMasterLabel(receiptId,
                           { UseDefaultLocation: false, LocationId: locationId, LotNo: lotNo, TransDate: now }) → masterLabelId
     e) DW PrintPurchased(masterLabelId, { printerName, qty })   // PUNA primljena količina
     f) UPDATE expected_receipt_item SET status='received', received_qty=qty,
            received_lot_no, received_location_id, dw_receipt_id, dw_master_label_id,
            label_printed=1, received_at=now
     g) Ako su sve stavke task-a 'received' → UPDATE task SET status='completed', completed_at=now
   Response: { itemStatus, dwReceiptId, taskStatus, labelPrinted }
6. Frontend: invalidira TanStack Query za task, prikazuje uspeh
```

### 5.3 Konkurentnost / idempotentnost

- Sequential prijem po stavkama (jedan task = jedan magacioner = nema race-a unutar task-a).
- Više magacionera radi paralelno svoje task-ove (DW kontroliše atomičnost preko PO release ID-jeva).
- Ako prijem failuje između koraka c–e → loguje se, item ostaje `pending` (ili `failed`), pamti se `error_message`.
- `Try again` najpre proverava postojeći DW receipt za `(poDetailId, poReleaseId, lotNo)`. Ako postoji → upiše `dw_receipt_id` i ide na sledeći neuspeli korak (npr. samo PostPOReceipt ili samo PrintPurchased).
- SQLite koristi `BEGIN IMMEDIATE` transakcije za pisanje, `SQLITE_BUSY` retry sa 100ms backoff (max 3).

## 6. Error handling

| Scenario | Detekcija | Backend odgovor | UI prikaz |
|----------|-----------|-----------------|-----------|
| DW nedostupan | axios timeout 15s / ECONNREFUSED | 503 `DW_UNREACHABLE` | Toast + "Try again" |
| Pogrešni kredencijali | DW 500 na `/User/Login` | 401 `AUTH_FAILED` | Inline error na login formi |
| AuthToken istekao | DW 403 mid-session | Auto re-login jednom, ako fail → 401 | Toast "Session expired" + redirect /login |
| Nema PO release-ova u opsegu | Prazna lista iz DW | 200 `{ groups: [] }` | "No expected receipts in date range" |
| Nema selekcije na Generate | Klient validacija | n/a | Dugme disabled + hint |
| Magacioner nije izabran | Klient validacija | n/a | Dugme disabled + hint |
| Qty > expected | Server validacija | 400 `INVALID_QTY` | Inline error |
| Qty ≤ 0 | Server validacija | 400 `INVALID_QTY` | Inline error |
| LotNo prazan | Server validacija | 400 `MISSING_LOT` | Inline error |
| LocationId prazan | Server validacija | 400 `MISSING_LOCATION` | Inline error |
| DW CreatePOReceipt fail | DW vraća error | 502 `DW_RECEIPT_CREATE_FAILED` + detalji | Toast + "Try again" |
| DW PostPOReceipt fail (Create je prošao) | DW vraća error | 502 `DW_RECEIPT_POST_FAILED` + receiptId | Toast "Receipt #X created but not posted — call admin", item ostaje pending sa error_message |
| Label print fail | DW vraća error | 200 `{ received: true, labelPrintError: ... }` | Item označen received + warning toast "Receipt OK, label print failed" |
| Email slanje fail | nodemailer error | 200 `{ taskCreated: true, emailError: ... }` | Toast "Task created. Email failed: ..." |
| Task već completed | DB check pre receive | 409 `TASK_COMPLETED` | Toast + reload |
| Stavka već received | DB check pre receive | 409 `ITEM_ALREADY_RECEIVED` | Reload + zelena oznaka |
| SQLite locked | better-sqlite3 SQLITE_BUSY | Retry sa 100ms backoff (max 3) | n/a (transparentno) |

**Logovanje (pino):**

Per-request: `{ requestId, sessionId, username, method, path, status, durationMs, dwCalls: [{ endpoint, status, ms }] }`.

Specifični eventi:

- `task.created` — `{ taskId, itemCount, assignedTo }`
- `notification.sent` — `{ taskId, channel: 'email'|'sse', recipient, success, error? }`
- `receipt.completed` — `{ taskId, itemId, dwReceiptId, masterLabelId, durationMs }`
- `receipt.failed` — `{ taskId, itemId, step: 'create'|'post'|'print', dwError }`
- `task.completed` — `{ taskId, totalItems, durationFromCreate }`

**Retry strategija:**

- DW network errors: 1× retry sa 1s backoff.
- DW 5xx na čitanju (poReleases, inventory): 1× retry.
- DW 5xx na prijemu (mutations): NE retry-ujemo automatski — magacioner ručno, idempotency provera štiti od duplikata.
- SMTP greške: ne retry-ujemo, task ostaje kreiran, email error se loguje u DB.

**Frontend rezilijencija:**

- Zustand `persist` u `localStorage` za Planning selection state i printer izbor.
- TanStack Query stale-while-revalidate.
- SSE auto-reconnect sa exponential backoff (1s, 2s, 4s, max 30s).
- Network status indikator u headeru (online/offline/dw-unreachable).

## 7. Testiranje

| Sloj | Alat | Pokriva |
|------|------|---------|
| `dwClient.poReleases` unit | Vitest + nock | filter konstrukcija (PromiseDate range, EPlantId), parse, remaining qty kalkulacija, batch inventory enrichment |
| `dwClient.poReceipts` unit | Vitest + nock | CreatePOReceipt + PostPOReceipt sekvenca, idempotency check, error pri svakom koraku |
| `dwClient.labels` unit | Vitest + nock | PrintPurchased poziv, fallback ako printer nedostupan |
| `taskService` unit | Vitest + in-memory SQLite | create task transactionally, lifecycle (open → in_progress → completed), cancel, "item already received" guard |
| `notificationService` unit | Vitest | SSE broadcast po username, multiple subscribers, cleanup na disconnect |
| `mailer` unit | Vitest + nodemailer mock | template render, error propagation (ne baca, vraća error info) |
| `routes` integration | Vitest + supertest + stub dwClient | status kodovi, validacija payload-a, auth middleware |
| `db migrations` | Vitest | migracije se primenjuju idempotentno, schema verifikacija |
| Frontend komponente | Vitest + React Testing Library | Planning selection state, ReceiveItemForm validacija, useNotifications SSE handling |
| E2E (opciono) | Playwright | login → planning → generate → receiving → receive item (manuelno, ne u CI) |

**Fixtures (`backend/test/fixtures/dw/`):**

- `poReleases_dateRange.json` — sample sa više release-ova različitih datuma
- `inventoryDetails.json` — sample item info
- `createPOReceipt.json`, `postPOReceipt.json`, `printPurchased.json`
- `employees_teamMember.json` — lista za dropdown
- `error_authFailed.json`, `error_dwTimeout.json`

**TDD pristup:** Po `superpowers:test-driven-development` — svaka jedinica koda dobija test PRE implementacije. Posebno kritično:

- `taskService.receiveItem` (transakcioni flow, idempotency)
- `dwClient.poReleases.listOpen` (filter sintaksa, remaining qty math)
- `notificationService.broadcast` (multiple subscribers, race conditions)

## 8. Šta JE i NIJE u v1

**JE u opsegu:**

- Login sa DW kredencijalima + izbor EPlant-a
- Planning ekran sa filterom po Promise Date range-u
- Lista otvorenih PO release stavki grupisanih po datumu
- Selekcija stavki + izbor magacionera + Generate task
- Email + in-app SSE notifikacija magacioneru
- Receiving lista task-ova
- Per-item prijem: CreatePOReceipt → PostPOReceiptAndUpdateMasterLabel → PrintPurchased (puna primljena količina)
- Idempotentnost ponovnog pokušaja prijema
- Cancel task-a (samo creator)
- Strukturisano logovanje
- Unit + integration testovi

**NIJE u opsegu (kasnije faze):**

- Editovanje task-a posle generisanja
- Inteligentno predlaganje magacionera po lokaciji ili load balancing
- Multi-language UI
- Offline mode
- Granularne korisničke role / pristupne kontrole
- Audit log u zasebnoj bazi (sve je u glavnoj SQLite)
- Resumability prekinutog prijema (samo "Try again")
- Mobile native app — sve je responsive web
- Bulk receive (sve stavke odjednom)
- Partial receipt sa rezervisanjem ostatka

## 9. Otvorena pitanja za fazu implementacije

Sva se rešavaju prvim pozivom na test DW VM tokom implementacije, ne blokiraju plan:

1. **Tačan DW endpoint za listu PO Releases u date range-u** — `GET POReceiving/PO/POReleaseItems` sa custom filterom, ili neki agregirani endpoint. Verifikovati na test VM.
2. **Default Receive Designator location** — koje polje na Inventory zapisu / Location-u tačno daje default RecvDesignator (hipoteza: `Location.ReceiveDesignator = true` flag). Verifikovati.
3. **Lista validnih lokacija za prijem** — koji DW endpoint vraća; po EPlant-u ili po artiklu? Možda `Locations/{id}?arinvtId=`.
4. **Master Label ID iz PostPOReceiptAndUpdateMasterLabel odgovora** — verifikovati polje u odgovoru; ako nema, query-jemo posle.
5. **Filter zaposlenih za "magacionere"** — Department/JobDescription konvencija nije fiksna; v1 prikazuje sve aktivne TeamMembers i dozvoljava korisniku da bira. Kasnije eventualno filter po polju.
6. **Email polje na Employee odgovoru** — proveriti da je popunjeno na production VM.
7. **EplantId filter format u PO Release endpoint-u** — testirati `EPlantId.eq~{id}~` vs alternative.
