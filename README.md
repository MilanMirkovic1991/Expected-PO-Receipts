# Expected PO Receipts — Prijem nabavnih porudžbenica

Web aplikacija (radi na računaru i na telefonu) koja pomaže **planerima** i **magacionerima** da obrade očekivani prijem robe po nabavnim porudžbenicama (PO) iz sistema **DELMIAWORKS**.

Cilj je da se posao oko prijema robe odvija bez papira: planer u sistemu odabere šta se očekuje i kome dodeljuje, a magacioner na telefonu primi robu i odštampa nalepnice — sve povezano direktno sa DELMIAWORKS-om.

---

## Sadržaj

- [Šta aplikacija radi](#šta-aplikacija-radi)
- [Dva toka rada](#dva-toka-rada)
- [Trenutni status](#trenutni-status)
- [Kako se pokreće](#kako-se-pokreće)
- [Tehnologija](#tehnologija)
- [Struktura projekta](#struktura-projekta)
- [Veza sa DELMIAWORKS-om](#veza-sa-delmiaworks-om)
- [Ključna nerešena stvar: ko je ulogovani radnik](#ključna-nerešena-stvar-ko-je-ulogovani-radnik)
- [Baza podataka](#baza-podataka)
- [Poznati problemi](#poznati-problemi)
- [Šta je u planu](#šta-je-u-planu)
- [Istorija razvoja](#istorija-razvoja)

---

## Šta aplikacija radi

DELMIAWORKS sam po sebi **nema pojam „zadatka za prijem robe"**. Ova aplikacija dodaje taj sloj:

1. Planer vidi sve otvorene stavke nabavnih porudžbenica koje treba da stignu (po datumu obećanog roka — *Promise Date*).
2. Planer odabere stavke, dodeli ih radniku i napravi **zadatak za prijem**.
3. Magacioner otvori svoj zadatak na telefonu i primi robu stavku po stavku.
4. Svaki prijem se odmah upisuje nazad u DELMIAWORKS (prijemnica + ažuriranje zaliha + štampa nalepnice).

Aplikacija pamti stanje zadataka u svojoj maloj bazi (jer DELMIAWORKS to ne ume), a sve vezano za robu, zalihe i prijemnice ide direktno u DELMIAWORKS.

---

## Dva toka rada

### 1. Planiranje (planer)

- Bira vremenski opseg (od–do datuma) i opciono pogon (EPlant).
- Vidi otvorene stavke PO porudžbenica grupisane i sortirane po obećanom datumu.
- Selektuje stavke i dodeljuje ih radniku.
- Pritiskom na „Generiši" pravi **zadatak za prijem** koji radnik onda vidi.

### 2. Prijem (magacioner)

- Vidi listu svojih zadataka.
- Otvara zadatak i prima svaku stavku posebno.
- Za svaku stavku aplikacija u DELMIAWORKS-u uradi tri koraka redom:
  1. `CreatePOReceipt` — napravi prijemnicu,
  2. `PostPOReceiptAndUpdateMasterLabel` — proknjiži prijem i ažurira master nalepnicu,
  3. `PrintPurchased` — odštampa nalepnicu za primljenu količinu.

---

## Trenutni status

| Funkcija | Status |
|---|---|
| Prijava DELMIAWORKS kredencijalima (`/User/Login`) | ✅ radi |
| Prikaz otvorenih PO stavki po datumu | ✅ radi |
| Pravljenje zadatka i dodela radniku | ✅ radi |
| Prijem robe (prijemnica + zalihe + nalepnica) | ✅ radi |
| Lista zadataka i prijem stavku po stavku | ✅ radi |
| Obaveštenja u aplikaciji dok je otvorena (SSE) | 🟡 osnova postoji |
| Da svaki radnik vidi **samo svoje** zadatke | ❌ još ne (vidi „Ključna nerešena stvar") |
| Slanje e-mailova | ❌ napušteno (nije potrebno u ovom modelu) |
| Instalacija kao aplikacija na telefonu (PWA) | ❌ u planu |
| Push obaveštenja kad je aplikacija zatvorena | ❌ u planu |

Legenda: ✅ gotovo · 🟡 delimično · ❌ nije urađeno

---

## Kako se pokreće

**Potrebno:**

- Node.js verzija 20 ili novija.
- Pristup DELMIAWORKS WebAPI servisu + ispravni kredencijali.
- Aplikacija se koristi **interno u firmi**, na lokalnoj mreži.

**Na Windows-u (najlakše):**

- `pokreni.bat` — pokreće aplikaciju (proverava zavisnosti, sačeka da bude spremna i sam otvori prozor).
- `zaustavi.bat` — zaustavlja aplikaciju.

**Ručno (dva terminala):**

```bash
npm run dev:backend   # http://localhost:3000  (server / pozadina)
npm run dev:frontend  # http://localhost:5173  (ono što se vidi u pretraživaču)
```

Zatim otvoriti `http://localhost:5173`, prijaviti se DELMIAWORKS kredencijalima + EPlant ID-jem i koristiti stranicu „Planiranje".

- **Backend** (server) sluša na portu **3000**.
- **Frontend** (ekran) sluša na portu **5173**.

---

## Tehnologija

**Backend (server, pozadina):**
- Node.js 20+ i TypeScript
- Express (web server)
- axios (poziva DELMIAWORKS WebAPI)
- better-sqlite3 (mala lokalna baza)
- pino (logovanje)
- Radi po „BFF" principu (*Backend For Frontend*) — frontend nikad ne priča sa DELMIAWORKS-om direktno, nego sve ide kroz naš server, koji čuva sesiju i token.

**Frontend (ono što korisnik vidi):**
- React + TypeScript
- Vite (razvojni server)
- TanStack Query (učitavanje podataka)
- Zustand (stanje aplikacije)
- React Router (navigacija između stranica)

---

## Struktura projekta

```
Expected PO Receipts/
├─ backend/                 # server (Node.js + Express + TypeScript)
│  └─ src/
│     ├─ server.ts          # ulazna tačka servera, povezuje sve rute
│     ├─ config.ts          # podešavanja (port 3000 itd.)
│     ├─ dwClient/          # komunikacija sa DELMIAWORKS-om
│     │  ├─ auth.ts         #   prijava (/User/Login → AuthToken)
│     │  ├─ poReleases.ts   #   otvorene PO stavke
│     │  ├─ poReceipts.ts   #   pravljenje i knjiženje prijemnica
│     │  ├─ labels.ts       #   štampa nalepnica
│     │  ├─ employees.ts    #   zaposleni (PR_EMP)
│     │  ├─ inventory.ts    #   opisi artikala / zalihe
│     │  └─ eplants.ts      #   pogoni
│     ├─ routes/            # API rute koje koristi frontend
│     ├─ middleware/        # sesija, obrada grešaka
│     ├─ services/          # logika zadataka, obaveštenja
│     └─ db/                # SQLite migracije i upiti
├─ frontend/                # ekran (React + Vite)
│  └─ src/
│     ├─ pages/             # Login, Planiranje, Prijem, Zadatak
│     ├─ components/        # tabele, kartice, forme
│     ├─ stores/            # stanje (sesija, planiranje)
│     └─ hooks/             # učitavanje podataka, obaveštenja
├─ docs/                    # dizajn dokument i specifikacija
├─ pokreni.bat             # pokretanje (Windows)
├─ zaustavi.bat            # zaustavljanje (Windows)
└─ README.md               # ovaj fajl
```

---

## Veza sa DELMIAWORKS-om

DELMIAWORKS WebAPI je stariji servis (IIS / ASP.NET). Komunikacija ide ovako:

- **Prijava:** `POST /User/Login` vraća **`AuthToken`** (i ništa drugo). Taj token se onda šalje u zaglavlju svakog sledećeg poziva.
- **Konvencija ruta:** `/{Modul}/{Kontroler}/{Entitet}/{id}` — npr. `/Workforce/EmployeeMaintenance/PREmployees/0`.
- **Tumačenje grešaka:**
  - `404` = ruta zaista ne postoji.
  - `500` često znači „ruta postoji, ali `id=0` pada jer neki obavezan parametar ne sme biti prazan" — treba probati sa pravim ID-jem.

**Najvažniji pozivi koje aplikacija koristi:**

| Šta radi | DELMIAWORKS poziv |
|---|---|
| Prijava | `POST /User/Login` |
| Otvorene PO stavke | `PO/PurchaseOrder` (po broju porudžbenice) |
| Pravljenje prijemnice | `CreatePOReceipt` |
| Knjiženje prijema | `PostPOReceiptAndUpdateMasterLabel` |
| Štampa nalepnice | `PrintPurchased` |
| Zaposleni | `PREmployees` |
| Pogoni | EPlant rute |

> **Bezbednost:** Lozinke i tajne stoje u `.env` fajlu koji **nije** u Git-u (gitignored). U kodu nema upisanih lozinki ni interne IP adrese servera. DELMIAWORKS token živi samo u memoriji servera i menja se pri svakoj prijavi.

---

## Ključna nerešena stvar: ko je ulogovani radnik

Da bi **svaki radnik video samo svoje** zadatke, aplikacija mora da poveže:

> ulogovani korisnik (login) → zaposleni (`PR_EMP`) → njegovi zadaci

Problem je što ta veza za sada nedostaje, pa aplikacija **trenutno svima prikazuje sve otvorene zadatke**.

Šta je do sada utvrđeno (kroz testiranje, ne nagađanje):

1. **Tabela `PR_EMP` nema e-mail kolonu.** Kolone su: Id, EmpNo, FirstName, LastName, PRDepartmentId, PRDepartment, DateHired, PluginEntityId, PluginEntity, SupervisorId, SupervisorEmpNo, PkHide. Zato je prvobitna ideja „pošalji e-mail zaduženom radniku" napuštena.
2. **Prijava (`/User/Login`) vraća samo `AuthToken`** — nema `PR_EMP_ID`, nema e-maila, čak ni korisničkog imena. Znači identitet zaposlenog **ne stiže** zajedno sa prijavom.
3. **Prava veza je tabela `S_USER_GENERAL`**, koja povezuje login korisnika sa `PR_EMP` preko kolone `PR_EMP_ID`. To (a ne e-mail) je ono što treba.
4. Probano je 12 pretpostavljenih WebAPI ruta za `S_USER_GENERAL` — **sve padaju** (404 ili 500).

**Sledeći korak (kad se nastavi):** ne nagađati dalje rute, nego:
- dobiti tačnu rutu / SQL pogled za `S_USER_GENERAL` iz DELMIAWORKS-a, ili
- naći „ko sam ja / trenutni korisnik" rutu na `/User` kontroleru, ili
- shvatiti 500 greške kao „ruta postoji" i probati sa pravim ID-jem umesto `0`.

---

## Baza podataka

Pošto DELMIAWORKS ne zna za „zadatke prijema", aplikacija ima svoju malu SQLite bazu sa dve tabele:

- `expected_receipt_task` — sam zadatak (ko ga je napravio, kome je dodeljen, status).
- `expected_receipt_item` — pojedinačne stavke unutar zadatka (šta se prima, koliko, status).

Sve ostalo (zalihe, prijemnice, nalepnice) **ne** stoji ovde — to ide pravo u DELMIAWORKS.

---

## Poznati problemi

- **Nema filtriranja po radniku** — svi vide sve zadatke (vidi „Ključna nerešena stvar").
- **Nema e-mail obaveštenja** — namerno napušteno u ovom modelu (radnik se sam prijavljuje).
- **Restart servera briše sesije** — sesije stoje u memoriji (traju 8h), pa kad se server ponovo pokrene, svi se moraju ponovo prijaviti.
- **`Inventory` 500 greške** — povremeno poziv `/Manufacturing/Inventory/Inventory/{id}` vrati grešku 500; nije kritično, samo opis artikla ostane prazan.

---

## Šta je u planu

Pravac razvoja (dogovoreno 01.06.2026): **interna aplikacija + sopstvena prijava**.

- **Instalacija na telefon (PWA):** web aplikacija koja se „instalira" na početni ekran telefona (ikonica, pun ekran), bez prodavnice aplikacija.
- **Prijava DELMIAWORKS kredencijalima:** samo DW korisnici mogu da uđu (već radi).
- **Svako vidi samo svoje zadatke:** preko `S_USER_GENERAL.PR_EMP_ID` veze.
- **Obaveštenja:**
  - Faza 1 — poruka unutar aplikacije dok je otvorena (lokalna mreža, lako, osnova postoji).
  - Faza 2 — push obaveštenje i kad je aplikacija zatvorena (zahteva internet na telefonu; interna Wi-Fi mreža ga možda nema, VPN to rešava).
- **Korišćenje samo unutar firme**, na lokalnoj mreži; ništa nije izloženo internetu. VPN je rezerva kad je neko van firme.

Parkirano (pomenuto, za kasnije): spajanje duplih stavki + „Opozovi" (Revoke) između rundi prijema.

---

## Istorija razvoja

Projekat je krenuo **27.05.2026** od dizajn dokumenta i plana implementacije, pa je redom napravljeno:

- osnovni server (Express) sa `/health` proverom, konfiguracijom i logovanjem,
- SQLite baza sa migracijama i upitima za zadatke/stavke,
- `dwClient` slojevi: prijava, otvorene PO stavke (sa dohvatanjem zaliha), prijemnice, nalepnice, zaposleni, pogoni,
- serverske rute: zadaci (CRUD + otkazivanje), prijem stavke, obaveštenja (SSE),
- frontend: prijava, planiranje (izbor datuma + tabela PO stavki + generisanje), lista prijema, stranica zadatka sa prijemom stavku po stavku,
- vizuelno doterivanje (dizajn sistem, boje, interaktivnost),
- pomoćne skripte `pokreni.bat` / `zaustavi.bat`,
- prelazak na `PR_EMP` za zadužene osobe i prikaz podataka o dobavljaču na porudžbenicama,
- istraživanje veze login↔zaposleni (`S_USER_GENERAL`) — u toku.

Detaljan dizajn: [`docs/superpowers/specs/2026-05-27-expected-po-receipts-design.md`](docs/superpowers/specs/2026-05-27-expected-po-receipts-design.md).
