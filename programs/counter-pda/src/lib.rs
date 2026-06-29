use anchor_lang::prelude::*;

declare_id!("H41nQSSvLGD8q8GmsXvrdCqU1dAgfbJK2MNS3Nauj2AL");

#[program]
pub mod counter_pda {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
