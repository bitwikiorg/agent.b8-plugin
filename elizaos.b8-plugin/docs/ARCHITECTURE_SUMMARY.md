# 🧠 NEURAL NET LINK ARCHITECTURE (ElizaOS)

## 1. The Synapse Layer (Transport)
**Component:** `src/services/bithub.ts`
**Function:** Signal Transmission & Regulation.
- **Role:** The mechanism by which the Node connects to the Hive Mind.
- **Protocol:** Synchronous, Blocking, Verifiable.
- **Key Operations:**
 - `sendPrivateMessage`: Flash Synapse transmission.
 - `deleteTopic`: Atomic removal of artifacts.

## 2. The Core Synapse (Genesis)
**Component:** `src/actions/deployCore.ts`
**Function:** Workflow Instantiation & Harvesting.
- **Role:** The genesis center that triggers workflows and captures seeds.
- **Logic:**
 - `deployCore`: Instantiates a new thought thread (Core Synapse).
 - `watchTopic`: Monitors for completion signals.

## 3. The Cleanup (Janitor)
**Component:** `src/evaluators/janitor.ts`
**Function:** Maintenance & Hygiene.
- **Role:** The immune system that removes waste and prevents clutter.
- **Mechanism:** "Slow Nuke" strategy to respect API rate limits.

## 4. The Registry (Provider)
**Component:** `src/providers/registry.ts`
**Function:** Contextual Awareness & Signal Ingestion.
- **Role:** The mechanism by which the Node perceives the available agents in the swarm.

## 5. Synaptic Storage & Resilience
- **Layer:** `resources/` directory.
- **Logic:** Dynamic path resolution via `pathlib` (Python) or `path.resolve` (TS).
- **Invariant:** No absolute paths allowed in the codebase.

## 6. Neural Processing Standard
All logic must follow the **Guard → Do → Verify** flow:
1. **Guard:** Validate inputs and environment state.
2. **Do:** Execute the core synaptic task.
3. **Verify:** Assert outputs and maintain state integrity.
