import {
  $,
  component$,
  useSignal,
  useTask$,
} from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";

/**
// ============================================================================
// REQUIREMENT TRACEABILITY
// ============================================================================
// Requirement ID: REQ-TTT-001
// User Story: As a user, I want to play Tic-Tac-Toe in a modern, responsive UI.
// Acceptance Criteria:
//  - 3x3 clickable grid preventing overwrites, alternating X/O
//  - Win detection for rows, columns, diagonals; detect draws; display status
//  - Reset button clears board and starts new game
//  - Score display beneath the board (X wins, O wins, Draws) in-memory
//  - Responsive centered layout for mobile and desktop
//  - Ocean Professional theme styling
//  - Inline documentation and light in-memory "audit" logging to console
// GxP Impact: NO - Frontend-only, non-persistent demo (adapts GxP style)
// Risk Level: LOW
// Validation Protocol: VP-TTT-FE-001 (informal; non-GxP demo)
// ============================================================================
//
// IMPORTS AND DEPENDENCIES
// - Qwik v1.x signals/components
// - No external services; no persistence; in-memory only
// ============================================================================
//
// FEATURE IMPLEMENTATION NOTES
// - State: board (array of 9), currentPlayer, winner, isDraw, scores {x,o,draws}, auditLog
// - Accessibility: role=grid & role=gridcell, aria-labels, focus states, buttons
// - Logging: Console audit entries with ISO timestamps, before/after board states
// - Error handling: Guard invalid indices and invalid move attempts
// ============================================================================
 */

/**
 * Type definitions for game state.
 */
type Player = "X" | "O";
type CellValue = Player | null;

interface Scores {
  x: number;
  o: number;
  draws: number;
}

interface AuditEntry {
  ts: string; // ISO 8601
  action: "MOVE" | "RESET" | "ERROR";
  index?: number;
  before: CellValue[];
  after: CellValue[];
  message?: string;
  // Placeholder for potential GxP-style fields (non-persistent demo)
  userId?: string; // would be set from auth context if present
  reason?: string;
}

/**
 * Helpers
 */
const WIN_LINES: number[][] = [
  // rows
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  // cols
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  // diags
  [0, 4, 8],
  [2, 4, 6],
];

//// PUBLIC_INTERFACE
function checkWinner(board: CellValue[]): Player | null {
  // Determine the winner for a given board.
  // GxP Critical: No
  // Parameters:
  //  - board: CellValue[] (length 9). Must be an array of 9 entries, each null or "X"/"O".
  // Returns:
  //  - "X" | "O" if a winner is found, or null otherwise.
  // Throws:
  //  - Error if board shape/values invalid.
  // Audit:
  //  - None (pure computation).

  if (!Array.isArray(board) || board.length !== 9) {
    throw new Error("checkWinner: invalid board length");
  }
  for (const v of board) {
    if (!(v === "X" || v === "O" || v === null)) {
      throw new Error("checkWinner: invalid board values");
    }
  }

  for (const [a, b, c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
}

//// PUBLIC_INTERFACE
function isBoardFull(board: CellValue[]): boolean {
  // Simple utility to check if the board is full (no nulls).
  if (!Array.isArray(board) || board.length !== 9) return false;
  return board.every((c) => c === "X" || c === "O");
}

// PUBLIC_INTERFACE
export default component$(() => {
  // Signals (reactive state)
  const board = useSignal<CellValue[]>(
    Array.from({ length: 9 }, () => null),
  );
  const currentPlayer = useSignal<Player>("X");
  const winner = useSignal<Player | null>(null);
  const isDraw = useSignal<boolean>(false);
  const scores = useSignal<Scores>({ x: 0, o: 0, draws: 0 });
  const statusMessage = useSignal<string>("Player X's turn");
  const auditLog = useSignal<AuditEntry[]>([]);

  // Initialize theme status text on mount/update
  useTask$(() => {
    statusMessage.value =
      winner.value
        ? `Winner: ${winner.value}`
        : isDraw.value
          ? "It's a draw"
          : `Player ${currentPlayer.value}'s turn`;
  });

  /**
   * Write an audit entry to in-memory log and console.
   */
  const writeAudit = $((entry: AuditEntry) => {
    auditLog.value = [...auditLog.value, entry];
    // Demonstration logging to DevTools console
    // In a regulated app, route this to a proper audit service.
    // eslint-disable-next-line no-console
    console.log("[AUDIT]", entry);
  });

  //// PUBLIC_INTERFACE
  const handleCellClick = $((index: number) => {
    // Handle a user's cell click with validation and audit logging.
    // GxP Critical: No (demo), but includes validation and audit scaffolding.
    // Parameters:
    //  - index: number (0..8)
    //  - ev: optional mouse event (not used for logic; for future extensibility)
    // Returns: void
    // Throws: none (errors recorded and logged)
    // Audit:
    //  - Action: MOVE
    //  - before/after board states
    //  - index of move
    try {
      if (typeof index !== "number" || isNaN(index) || index < 0 || index > 8) {
        const before = [...board.value];
        const after = [...board.value];
        writeAudit({
          ts: new Date().toISOString(),
          action: "ERROR",
          before,
          after,
          index,
          message: "Invalid cell index",
        });
        // eslint-disable-next-line no-console
        console.error("Invalid move index:", index);
        return;
      }

      // Prevent moves after game ended
      if (winner.value || isDraw.value) {
        const before = [...board.value];
        const after = [...board.value];
        writeAudit({
          ts: new Date().toISOString(),
          action: "ERROR",
          before,
          after,
          index,
          message: "Move attempted after game ended",
        });
        return;
      }

      // Prevent overwriting moves
      if (board.value[index] !== null) {
        const before = [...board.value];
        const after = [...board.value];
        writeAudit({
          ts: new Date().toISOString(),
          action: "ERROR",
          before,
          after,
          index,
          message: "Overwrite attempt blocked",
        });
        return;
      }

      const before = [...board.value];

      // Place mark
      const nextBoard = [...board.value];
      nextBoard[index] = currentPlayer.value;
      board.value = nextBoard;

      // Check for winner
      let roundWinner: Player | null = null;
      try {
        roundWinner = checkWinner(nextBoard);
      } catch (err) {
        writeAudit({
          ts: new Date().toISOString(),
          action: "ERROR",
          before,
          after: nextBoard,
          index,
          message: `checkWinner error: ${(err as Error)?.message ?? "unknown"}`,
        });
        // eslint-disable-next-line no-console
        console.error(err);
        return;
      }

      if (roundWinner) {
        winner.value = roundWinner;
        statusMessage.value = `Winner: ${roundWinner}`;
        if (roundWinner === "X") {
          scores.value = { ...scores.value, x: scores.value.x + 1 };
        } else {
          scores.value = { ...scores.value, o: scores.value.o + 1 };
        }
      } else if (isBoardFull(nextBoard)) {
        isDraw.value = true;
        statusMessage.value = "It's a draw";
        scores.value = { ...scores.value, draws: scores.value.draws + 1 };
      } else {
        // Toggle player
        currentPlayer.value = currentPlayer.value === "X" ? "O" : "X";
        statusMessage.value = `Player ${currentPlayer.value}'s turn`;
      }

      writeAudit({
        ts: new Date().toISOString(),
        action: "MOVE",
        before,
        after: [...board.value],
        index,
      });
    } catch (err) {
      const before = [...board.value];
      const after = [...board.value];
      writeAudit({
        ts: new Date().toISOString(),
        action: "ERROR",
        before,
        after,
        message: `handleCellClick fatal error: ${(err as Error)?.message ?? "unknown"}`,
      });
      // eslint-disable-next-line no-console
      console.error(err);
    }
  });

  //// PUBLIC_INTERFACE
  const resetGame = $(() => {
    // Reset the game board and state; maintains cumulative scores.
    // GxP Critical: No
    // Parameters: none
    // Returns: void
    // Throws: none
    // Audit:
    //  - Action: RESET
    //  - Logs before/after board
    const before = [...board.value];
    board.value = Array.from({ length: 9 }, () => null);
    winner.value = null;
    isDraw.value = false;
    // Alternate who starts each reset for fairness
    currentPlayer.value = currentPlayer.value === "X" ? "O" : "X";
    statusMessage.value = `Player ${currentPlayer.value}'s turn`;
    writeAudit({
      ts: new Date().toISOString(),
      action: "RESET",
      before,
      after: [...board.value],
      reason: "User initiated reset",
    });
  });

  /**
   * Render
   */
  return (
    <div
      class="ttt-page"
      style={{
        // gradient background
        background:
          "linear-gradient(135deg, rgba(37,99,235,0.06), rgba(249,250,251,1))",
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "1rem",
      }}
    >
      <div
        class="ttt-container"
        style={{
          width: "100%",
          maxWidth: "560px",
          background: "var(--surface)",
          color: "var(--text)",
          borderRadius: "16px",
          boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
          padding: "1.25rem",
        }}
        aria-live="polite"
      >
        <header style={{ textAlign: "center", marginBottom: "0.75rem" }}>
          <h1
            style={{
              margin: 0,
              fontSize: "1.5rem",
              color: "var(--text)",
              letterSpacing: "-0.02em",
            }}
          >
            Tic-Tac-Toe
          </h1>
          <p
            style={{
              margin: "0.25rem 0 0",
              color: "var(--text-muted)",
              fontSize: "0.95rem",
            }}
          >
            Ocean Professional
          </p>
        </header>

        <section
          class="status-bar"
          style={{
            display: "flex",
            gap: "0.5rem",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            padding: "0.75rem 0.875rem",
            borderRadius: "12px",
            marginBottom: "1rem",
          }}
        >
          <span
            style={{
              fontWeight: 600,
              color: winner.value
                ? "var(--success)"
                : (isDraw.value ? "var(--secondary)" : "var(--primary)"),
              transition: "color 150ms ease",
            }}
            aria-live="polite"
            aria-atomic="true"
          >
            {statusMessage.value}
          </span>
          <button
            type="button"
            onClick$={resetGame}
            class="btn-reset"
            aria-label="Reset game"
            title="Reset game"
            style={{
              appearance: "none",
              border: "1px solid var(--border)",
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.85), rgba(255,255,255,0.6))",
              color: "var(--text)",
              padding: "0.5rem 0.75rem",
              borderRadius: "10px",
              cursor: "pointer",
              fontWeight: 600,
              transition: "transform 120ms ease, box-shadow 150ms ease",
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            }}
            onMouseDown$={$(() => {
              // small press effect
              // (purely visual)
            })}
            onKeyDown$={$((e) => {
              if (e.key === "Enter" || e.key === " ") resetGame();
            })}
          >
            Reset
          </button>
        </section>

        <section
          class="board"
          role="grid"
          aria-label="Tic-Tac-Toe board"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "12px",
            width: "100%",
          }}
        >
          {board.value.map((cell, idx) => {
            const label = cell
              ? `Cell ${idx + 1}, ${cell}`
              : `Cell ${idx + 1}, empty`;
            const disabled = !!cell || !!winner.value || isDraw.value;
            return (
              <button
                key={idx}
                role="gridcell"
                aria-label={label}
                data-cell-index={idx}
                disabled={disabled}
                class="cell"
                onClick$={() => handleCellClick(idx)}
                style={{
                  aspectRatio: "1 / 1",
                  width: "100%",
                  borderRadius: "14px",
                  border: "1px solid var(--border)",
                  background: "var(--surface)",
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 800,
                  fontSize: "2rem",
                  letterSpacing: "0.02em",
                  color:
                    cell === "X"
                      ? "var(--primary)"
                      : (cell === "O" ? "var(--error)" : "var(--text)"),
                  cursor: disabled ? "not-allowed" : "pointer",
                  boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
                  transition:
                    "transform 120ms ease, box-shadow 150ms ease, background 150ms ease",
                }}
                onMouseDown$={$((e) => {
                  // minor press animation
                  const t = e.currentTarget as HTMLButtonElement;
                  t.style.transform = "translateY(1px) scale(0.995)";
                })}
                onMouseUp$={$((e) => {
                  const t = e.currentTarget as HTMLButtonElement;
                  t.style.transform = "";
                })}
                onBlur$={$((e) => {
                  const t = e.currentTarget as HTMLButtonElement;
                  t.style.transform = "";
                })}
              >
                {cell || ""}
              </button>
            );
          })}
        </section>

        <section
          class="scores"
          style={{
            marginTop: "1rem",
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "12px",
          }}
          aria-label="Scoreboard"
        >
          <div class="score-card" style={scoreCardStyle()}>
            <div style={scoreTitleStyle("var(--primary)")}>X Wins</div>
            <div style={scoreValueStyle()} aria-label={`X wins ${scores.value.x}`}>
              {scores.value.x}
            </div>
          </div>
          <div class="score-card" style={scoreCardStyle()}>
            <div style={scoreTitleStyle("var(--error)")}>O Wins</div>
            <div style={scoreValueStyle()} aria-label={`O wins ${scores.value.o}`}>
              {scores.value.o}
            </div>
          </div>
          <div class="score-card" style={scoreCardStyle()}>
            <div style={scoreTitleStyle("var(--secondary)")}>Draws</div>
            <div
              style={scoreValueStyle()}
              aria-label={`Draws ${scores.value.draws}`}
            >
              {scores.value.draws}
            </div>
          </div>
        </section>

        <footer
          style={{
            marginTop: "0.75rem",
            textAlign: "center",
            color: "var(--text-muted)",
            fontSize: "0.85rem",
          }}
        >
          Session scores are in-memory only.
        </footer>
      </div>
    </div>
  );
});

// Inline helpers for score styles to keep the file self-contained
function scoreCardStyle(): Record<string, string> {
  return {
    background: "var(--surface-2)",
    border: "1px solid var(--border)",
    borderRadius: "12px",
    padding: "0.75rem",
    display: "grid",
    placeItems: "center",
    boxShadow: "0 4px 14px rgba(0,0,0,0.05)",
  };
}

function scoreTitleStyle(color: string): Record<string, string> {
  return {
    fontSize: "0.85rem",
    fontWeight: "700",
    color,
    marginBottom: "0.25rem",
    letterSpacing: "0.02em",
  };
}

function scoreValueStyle(): Record<string, string> {
  return {
    fontSize: "1.5rem",
    fontWeight: "800",
    color: "var(--text)",
  };
}

export const head: DocumentHead = {
  title: "Tic-Tac-Toe | Ocean Professional",
  meta: [
    {
      name: "description",
      content:
        "Responsive Tic-Tac-Toe built with Qwik. Ocean Professional theme. Accessible and modern.",
    },
  ],
};
