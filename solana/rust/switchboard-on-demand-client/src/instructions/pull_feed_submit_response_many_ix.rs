use crate::get_discriminator;
use borsh::{BorshDeserialize, BorshSerialize};
use solana_sdk::instruction::AccountMeta;
use solana_sdk::pubkey::Pubkey;

#[derive(Clone, Debug)]
pub struct PullFeedSubmitResponseMany {
    pub queue: Pubkey,
    pub program_state: Pubkey,
    pub recent_slothashes: Pubkey,
    // mut
    pub payer: Pubkey,
    pub system_program: Pubkey,
    // mut
    pub reward_vault: Pubkey,
    pub token_program: Pubkey,
    pub token_mint: Pubkey,
}

impl PullFeedSubmitResponseMany {
    pub fn to_account_metas(&self, _is_signer: Option<bool>) -> Vec<AccountMeta> {
        vec![
            AccountMeta::new_readonly(self.queue, false),
            AccountMeta::new_readonly(self.program_state, false),
            AccountMeta::new_readonly(self.recent_slothashes, false),
            AccountMeta::new(self.payer, true),
            AccountMeta::new_readonly(self.system_program, false),
            AccountMeta::new(self.reward_vault, false),
            AccountMeta::new_readonly(self.token_program, false),
            AccountMeta::new_readonly(self.token_mint, false),
        ]
    }
}

#[derive(Clone, BorshSerialize, BorshDeserialize)]
pub struct MultiSubmission {
    pub values: Vec<i128>, // i128::MAX is a sentinel value for missing data
    pub signature: [u8; 64],
    pub recovery_id: u8,
}
#[derive(Clone, BorshSerialize, BorshDeserialize)]
pub struct PullFeedSubmitResponseManyParams {
    pub slot: u64,
    pub submissions: Vec<MultiSubmission>,
}
impl PullFeedSubmitResponseManyParams {
    pub fn to_vec(&self) -> Vec<u8> {
        let mut buffer: Vec<u8> = Vec::new();
        self.serialize(&mut buffer).unwrap();
        buffer
    }

    pub fn data(&self) -> Vec<u8> {
        let mut res = get_discriminator("pull_feed_submit_response_many").to_vec();
        res.extend_from_slice(&self.to_vec());
        res
    }
}
