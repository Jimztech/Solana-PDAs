# Counter PDA — Anchor Program

A minimal Solana program built with Anchor that demonstrates per-user PDA accounts, authority enforcement, and basic state mutation (initialize + increment).

## What this program does

- Each user gets their own **Counter PDA**, derived from a static seed (`"counter"`) plus their wallet pubkey — so every wallet has a unique, deterministic counter account.
- `initialize` creates the PDA and sets `count = 0`, recording the caller as `authority`.
- `increment` increases `count` by 1, but only the original `authority` can call it successfully.

## Account structure

```rust
#[account]
pub struct Counter {
    pub authority: Pubkey, // who owns/controls this counter (32 bytes)
    pub count: u64,        // the current count (8 bytes)
    pub bump: u8,          // PDA bump seed, stored for verification (1 byte)
}
```

Space allocated on `init`: `8 (discriminator) + 32 + 8 + 1 = 49 bytes`.

## PDA derivation

Seeds: `["counter", authority_pubkey]`

This same seed combination is used in three places, and all three must match exactly or instructions will fail with a seeds-constraint error:

1. **Rust — `Initialize` accounts struct** (creates the PDA)
2. **Rust — `Increment` accounts struct** (re-derives the PDA to locate/verify it)
3. **TypeScript tests** via `PublicKey.findProgramAddressSync(...)` (client-side derivation, used to fetch/inspect the account)

Because the seed includes the user's pubkey, every wallet gets its own independent counter — no collisions between users.

## Instructions

### `initialize`
- Creates the Counter PDA (`init` constraint — fails if it already exists).
- Payer = the calling wallet (`authority`).
- Sets `count = 0` and stores the derived `bump`.

### `increment`
- Requires the PDA to already exist (`mut`, no `init`).
- Re-derives the PDA using the stored `bump` for a stricter check (`bump = counter.bump`) instead of just re-deriving fresh.
- `has_one = authority` enforces that only the wallet stored as `authority` on the account can call this — anyone else's transaction will fail.
- Increments `count` using `checked_add` to guard against overflow.

## Anchor client quirk (0.31.x)

In newer Anchor versions, any account the IDL can resolve automatically — PDAs derived from seeds, or well-known programs like the System Program — **cannot** be passed manually in `.accounts({...})`. Doing so throws a TypeScript error like:

```
Object literal may only specify known properties, and 'counter' does not exist in type 'ResolvedAccounts<...>'
```

Fix: only pass accounts Anchor *can't* infer (here, just `authority`):

```typescript
await program.methods
  .initialize()
  .accounts({ authority })
  .rpc();
```

If you ever need to pass auto-resolved accounts manually (e.g. to deliberately test a wrong PDA), use `.accountsPartial({...})` instead, which skips this strict check.

## Tests (`tests/counter-pda.ts`)

Covers, in order:

1. **Initialize** — calls `initialize`, fetches the account, asserts `count === 0`, `authority` matches the wallet, and `bump` matches the client-derived bump.
2. **Increment x3** — calls `increment` three times sequentially, then asserts `count === 3` by reading the actual on-chain value (not just checking the calls didn't throw).
3. **Duplicate initialize fails** — calls `initialize` again on the same PDA and asserts it throws (`already in use`), proving the `init` constraint correctly prevents re-creation.
4. **PDA ownership check** — fetches the raw account via `connection.getAccountInfo`, confirming the account is owned by the program (not the System Program or anything else).

## Running it

```bash
anchor build
anchor keys list        # copy the printed program ID into declare_id! and Anchor.toml, then rebuild
anchor build
anchor test              # spins up a local validator and runs all tests
```

## Manual CLI inspection

After deploying (`anchor deploy`), you can inspect a counter PDA directly:

```bash
solana account <COUNTER_PDA_ADDRESS> --output json
```

Confirms `owner` is your program ID, and that account `data` is populated (8-byte discriminator + your struct fields).

## Known toolchain gotcha

Anchor 0.31.1 requires a matching nightly-compatible Rust toolchain — earlier Anchor versions break on `proc_macro::Span::source_file()` with newer Rust. If you hit build errors here, check that `Anchor.toml`'s `[toolchain]` section and your `Cargo.toml`'s `anchor-lang` version are aligned, and that Anchor itself was built against the same Rust version you have installed.
