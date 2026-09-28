# Project Context: DE-Nile (CPSS P&ID Interface)

This file gives any AI coding/task agent the confirmed facts about this project. Agents (and contributors) should treat everything below as the source of truth and should **not** invent test-stand safety behavior, control logic, or data contracts beyond what's listed here.

**Repo:** https://github.com/OkitaWasHere/DE-Nile

## Product
A P&ID (piping & instrumentation diagram) module embedded in the NILE console dashboard, plus a standalone P&ID editor, built for Cal Poly's Space Systems (CPSS) club and doubling as a software engineering class project. The module renders a live rocket-test-stand diagram whose symbols, colors, and numbers update from incoming sensor/valve state; the editor lets club members build and edit those diagrams without touching code.

## Users
- **Test Conductor / Safety Officer** — needs a fast, unambiguous visual read of valve/sensor state during a live test.
- **Test Stand Engineer / Editor** — builds and edits P&ID diagrams for a new or changed test stand configuration.
- **Integration Engineer (avionics/DAQ)** — owns the system sending sensor & valve state; needs a stable, documented tag/data contract.
- **Course Instructor / Grader** — evaluates the software engineering artifacts (sprint planning, testing, demos), not the rocket hardware.
- **Club Member / Observer** — wants read-only visibility into a live test.

## Evidence
- CPSS test stands are wired with sensors (pressure transducers, thermocouples, flow meters, force transducers) and valves (solenoid, pneumatic, hand-actuated), but current visibility is raw numbers only — no visual "system state at a glance."
- CPSS reconfigures test stands frequently (different engines/propellants/instrumentation), so a hardcoded diagram goes stale fast.
- Other NILE console modules — controls, time-series graphs, logging, status bar, layout manager — are owned by other teams, not this one.

## Confirmed Decisions
- The P&ID renderer is a **module inside the NILE dashboard**, not a standalone app — it reads live state via the dashboard's global data source table and an update callback; it does not own its own network connection.
- The P&ID editor **is** a standalone app, separate from the live dashboard, that can operate offline as long as it's given the names/types of available data tags.
- The system is **strictly read-only with respect to hardware** — it never sends commands to the test stand. This is a deliberate safety boundary, not an oversight.
- Every module's state must have a **text representation available at all times** — color or animation alone is not sufficient.
- The diagram must **auto-scale** across screen sizes from laptop to TV, including odd aspect ratios from the dashboard's tiling layout.
- Connections between modules must support **at least right-angle (orthogonal) routing**, with settable line colors.
- Scope is **piping only** (fuel + oxidizer + pressurant gas lines) — no electrical wiring.
- No data logging/historization in this module — it's a live mirror of current state only.

## Constraints
- Do not invent test-stand control logic, safety interlocks, or operating modes that haven't been confirmed by the avionics/DAQ or safety team.
- The exact shape of the NILE console's global data source table and update callback must come from that team directly, not be assumed.
- The exact telemetry tag names, types, units, and update rate must come from the avionics/DAQ team directly, not be assumed.
- Symbol/legend fidelity should match CPSS's existing P&ID convention (hand valve, pneumatic valve, solenoid valve, check valve, regulator, pressure safety valve, pressure/force transducers, thermocouple, flow meter, quick disconnect, orifice plate, filter, flex hose, pump + motor) rather than inventing new iconography.

## Open Questions (require team/stakeholder decision — do not guess)
- Who owns the P&ID module vs. the P&ID editor within this 3-person team, relative to how the NILE design doc assigns them (it references "Emilia" for the module and "Lara" for the editor)?
- What is the exact interface (data shape, update frequency, callback signature) of the NILE console's global data source table?
- What are the real telemetry tag names/types/units from the avionics/DAQ system?
- Does the course require auth and/or a persistent database as graded features, or can Phase 1 skip both?
- What is the actual course sprint calendar, to size the Sprint 1–6 roadmap correctly?

## Task Prompt Pattern
When asking an AI agent for requirements, code, or diagrams for this project, use this pattern:

> Using only the evidence and confirmed decisions above:
> 1. Draft the specific requirement, story, or code needed.
> 2. List any assumptions made, separately.
> 3. List any questions that require a stakeholder decision (course instructor, avionics/DAQ team, NILE console team, or CPSS safety lead) rather than guessing.
> 4. Do not invent test-stand control logic, safety behavior, or data contracts not listed above.
