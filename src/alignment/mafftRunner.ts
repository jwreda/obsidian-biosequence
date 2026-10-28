// Node built-ins are loaded lazily inside runMafft so the plugin still loads
// on mobile, where they don't exist. Only the types are imported here.
import type * as ChildProcess from "child_process";
import type * as Fs from "fs";
import type * as Os from "os";
import type * as Path from "path";

/**
 * Run MAFFT pairwise alignment on two sequences.
 *
 * Creates a temporary FASTA file with both sequences, runs `mafft --auto`,
 * captures the aligned FASTA output from stdout, and cleans up.
 *
 * @param seq1 - First sequence (plain residues, no gaps)
 * @param seq2 - Second sequence (plain residues, no gaps)
 * @param header1 - Header for the first sequence
 * @param header2 - Header for the second sequence
 * @param mafftPath - Path to the MAFFT binary (default: "mafft")
 * @returns The aligned multi-FASTA string from MAFFT stdout
 */
export function runMafft(
	seq1: string,
	seq2: string,
	header1: string,
	header2: string,
	mafftPath: string
): Promise<string> {
	/* eslint-disable @typescript-eslint/no-var-requires */
	const { execFile } = require("child_process") as typeof ChildProcess;
	const { writeFileSync, unlinkSync } = require("fs") as typeof Fs;
	const { tmpdir } = require("os") as typeof Os;
	const { join, delimiter } = require("path") as typeof Path;
	/* eslint-enable @typescript-eslint/no-var-requires */

	const tmpFile = join(
		tmpdir(),
		`biosequence-mafft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.fasta`
	);

	const fastaContent = [
		`>${header1}`,
		seq1,
		`>${header2}`,
		seq2,
		"",
	].join("\n");

	writeFileSync(tmpFile, fastaContent, "utf-8");

	// GUI apps on macOS don't inherit the shell PATH, so add the usual install dirs
	const extraDirs = process.platform === "win32"
		? []
		: ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"];
	const augmentedPath = [...extraDirs, process.env.PATH ?? ""].join(delimiter);

	return new Promise<string>((resolve, reject) => {
		const child = execFile(
			mafftPath,
			["--auto", tmpFile],
			{ timeout: 30000, maxBuffer: 10 * 1024 * 1024, env: { ...process.env, PATH: augmentedPath } },
			(error, stdout, stderr) => {
				// Clean up temp file regardless of outcome
				try {
					unlinkSync(tmpFile);
				} catch {
					// Ignore cleanup errors
				}

				if (error) {
					const msg = stderr
						? `MAFFT error: ${stderr.trim()}`
						: `MAFFT failed: ${error.message}`;
					reject(new Error(msg));
					return;
				}

				if (!stdout || stdout.trim().length === 0) {
					reject(new Error("MAFFT produced no output"));
					return;
				}

				resolve(stdout);
			}
		);

		// Handle spawn errors (e.g., binary not found)
		child.on("error", (err: NodeJS.ErrnoException) => {
			try {
				unlinkSync(tmpFile);
			} catch {
				// Ignore cleanup errors
			}

			if (err.code === "ENOENT") {
				reject(
					new Error(
						`MAFFT binary not found at "${mafftPath}". Install MAFFT or update the path in settings.`
					)
				);
			} else {
				reject(new Error(`Failed to run MAFFT: ${err.message}`));
			}
		});
	});
}
