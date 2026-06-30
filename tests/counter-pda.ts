import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { CounterPda } from "../target/types/counter_pda";
import { PublicKey } from "@solana/web3.js";
import { assert } from "chai";

describe("counter-pda", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.CounterPda as Program<CounterPda>;
  const authority = provider.wallet.publicKey;

  // Derive PDA client-side — must match on-chain seeds exactly
  const [counterPda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("counter"), authority.toBuffer()],
    program.programId
  );

  it("initializes the counter to 0", async () => {
    await program.methods
      .initialize()
      .accounts({
        authority: authority,
      })
      .rpc();

    const account = await program.account.counter.fetch(counterPda);

    assert.strictEqual(account.count.toNumber(), 0);
    assert.ok(account.authority.equals(authority));
    assert.strictEqual(account.bump, bump);
  });

  it("increments 3 times and asserts count = 3", async () => {
    for (let i = 0; i < 3; i++) {
      await program.methods
        .increment()
        .accounts({
          authority: authority,
        })
        .rpc();
    }

    const account = await program.account.counter.fetch(counterPda);
    assert.strictEqual(account.count.toNumber(), 3); // value assertion, not just "didn't throw"
  });

  it("fails on duplicate initialize", async () => {
    try {
      await program.methods
        .initialize()
        .accounts({
          authority: authority,
        })
        .rpc();
      assert.fail("Expected duplicate initialize to throw");
    } catch (err) {
      // Account already in use -> init constraint fails
      assert.include(err.toString(), "already in use");
    }
  });

  it("confirms client-derived PDA matches the fetched account owner", async () => {
    const accountInfo = await provider.connection.getAccountInfo(counterPda);
    assert.ok(accountInfo !== null, "PDA account should exist");
    assert.ok(
      accountInfo.owner.equals(program.programId),
      "PDA owner should be the program"
    );
  });
});