use crate::AmdSevSnpAttestation;
use crate::COCO_ATTEST_URL;
use anyhow::Context;
use anyhow::Error as AnyhowError;
use serde_json::Value;
use sev::firmware::guest::AttestationReport as ReprAttestationReport;
use sev_snp_utilities::guest::attestation::report::AttestationReport as LitAttestationReport;
// use sev_snp_utilities::BuildVersion;
// use sev_snp_utilities::FamilyId;
// use sev_snp_utilities::ImageId;
// use sev_snp_utilities::LaunchDigest;
// use sev_snp_utilities::Policy;
// use sev_snp_utilities::Signature;
// use sev_snp_utilities::TcbVersion;
use sha2::{Digest, Sha256};

impl AmdSevSnpAttestation {
    pub async fn attest(message: &str) -> Result<LitAttestationReport, AnyhowError> {
        println!("Starting attestation for message: {}", message);
        let serialized = Self::attest_base(message).await?;
        println!("Received serialized data length: {}", serialized.len());
        let mut cursor = std::io::Cursor::new(serialized);
        println!("Created cursor at position: {}", cursor.position());
        let lit_report = LitAttestationReport::from_reader(&mut cursor)
            .context("Failed to parse LitAttestationReport from cursor")?;
        println!("Successfully parsed LitAttestationReport");
        Ok(lit_report)
    }

    pub async fn attest_base(message: &str) -> Result<Vec<u8>, AnyhowError> {
        let digest = Sha256::digest(message.as_bytes()).to_vec();
        let msg = hex::encode(digest);
        let url = format!("{}/aa/evidence?runtime_data={}", COCO_ATTEST_URL, msg);
        println!("Making request to URL: {}", url);

        // First check the response status
        let response = reqwest::get(url)
            .await
            .context("Failed to get AMD SEV report")?;

        let status = response.status();
        println!("Response status: {}", status);

        // Return early if not successful
        if !status.is_success() {
            let error_text = response.text().await?;
            return Err(anyhow::anyhow!(
                "Server returned error {}: {}",
                status,
                error_text
            ));
        }

        // Now handle the successful response
        let report_text = response
            .text()
            .await
            .context("Failed to get response text")?;

        if report_text.trim().is_empty() {
            return Err(anyhow::anyhow!("Received empty response from server"));
        }

        println!("Raw response text: {}", report_text);

        let report: Value =
            serde_json::from_str(&report_text).context("Failed to parse response as JSON")?;
        println!("Parsed initial JSON response");

        let attestation_report = &report["attestation_report"];
        if attestation_report.is_null() {
            return Err(anyhow::anyhow!("No attestation_report field in response"));
        }
        println!("Attestation report JSON: {}", attestation_report);

        let report = serde_json::from_value::<ReprAttestationReport>(attestation_report.clone())
            .context("Failed to parse attestation report")?;
        println!("Successfully parsed ReprAttestationReport");

        let serialized =
            bincode::serialize(&report).context("Failed to serialize AMD SEV report")?;
        println!("Serialized report length: {}", serialized.len());

        Ok(serialized)
    }
}
