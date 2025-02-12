import {
  isDevnetConnection,
  isMainnetConnection,
  ON_DEMAND_DEVNET_PID,
  ON_DEMAND_MAINNET_PID,
} from "../utils";
import { getFs } from "../utils/fs";

import {
  AnchorProvider,
  BorshEventCoder,
  Program,
  web3,
} from "@coral-xyz/anchor";
import yaml from "js-yaml";

type SolanaConfig = {
  rpcUrl: string;
  webSocketUrl: string;
  keypairPath: string;
  commitment: web3.Commitment;
  keypair: web3.Keypair;
  connection: web3.Connection;
  provider: AnchorProvider;
  wallet: any;
  program: Program | null;
};

/*
 * AnchorUtils is a utility class that provides helper functions for working with
 * the Anchor framework. It is a static class, meaning that it does not need to be
 * instantiated to be used. It is a collection of helper functions that can be used
 * to simplify common tasks when working with Anchor.
 */
export class AnchorUtils {
  private static async initWalletFromKeypair(keypair: web3.Keypair) {
    const { default: NodeWallet } = await import(
      "@coral-xyz/anchor/dist/cjs/nodewallet"
    );
    return new NodeWallet(keypair);
  }

  /**
   * Initializes a wallet from a file.
   *
   * @param {string} filePath - The path to the file containing the wallet's secret key.
   * @returns {Promise<[Wallet, web3.Keypair]>} A promise that resolves to a tuple containing the wallet and the keypair.
   */
  static async initWalletFromFile(filePath: string) {
    const keypair = await AnchorUtils.initKeypairFromFile(filePath);
    const wallet = await AnchorUtils.initWalletFromKeypair(keypair);
    return [wallet, keypair] as const;
  }

  /**
   * Initializes a keypair from a file.
   *
   * @param {string} filePath - The path to the file containing the keypair's secret key.
   * @returns {Promise<web3.Keypair>} A promise that resolves to the keypair.
   */
  static async initKeypairFromFile(filePath: string): Promise<web3.Keypair> {
    const secretKeyString = getFs().readFileSync(filePath, {
      encoding: "utf8",
    });
    const secretKey: Uint8Array = Uint8Array.from(JSON.parse(secretKeyString));
    const keypair = web3.Keypair.fromSecretKey(secretKey);
    return keypair;
  }

  /**
   * Loads an Anchor program from a connection.
   *
   * @param {web3.Connection} connection - The connection to load the program from.
   * @returns {Promise<Program>} A promise that resolves to the loaded Anchor program.
   */
  static async loadProgramFromConnection(connection: web3.Connection) {
    const isDevnet = await isDevnetConnection(connection);
    const pid = isDevnet ? ON_DEMAND_DEVNET_PID : ON_DEMAND_MAINNET_PID;
    const wallet = await this.initWalletFromKeypair(new web3.Keypair());
    const provider = new AnchorProvider(connection, wallet);
    return Program.at(pid, provider);
  }

  /**
   * Loads an Anchor program from the environment.
   *
   * @returns {Promise<Program>} A promise that resolves to the loaded Anchor program.
   */
  static async loadProgramFromEnv(): Promise<Program> {
    const config = await AnchorUtils.loadEnv();
    const isDevnet = await isDevnetConnection(config.connection);
    const pid = isDevnet ? ON_DEMAND_DEVNET_PID : ON_DEMAND_MAINNET_PID;
    return Program.at(pid, config.provider);
  }

  /**
   * Loads the same environment set for the Solana CLI.
   *
   * @returns {Promise<SolanaConfig>} A promise that resolves to the Solana configuration.
   */
  static async loadEnv(): Promise<SolanaConfig> {
    const configPath = "~/.config/solana/cli/config.yml";
    const fileContents = getFs().readFileSync(configPath, "utf8");
    const data = yaml.load(fileContents);

    const commitment = data.commitment as web3.Commitment;
    const connection = new web3.Connection(data.json_rpc_url, {
      commitment,
      wsEndpoint: data.websocket_url,
    });

    const keypairPath = data.keypair_path;
    const keypair = (await AnchorUtils.initWalletFromFile(keypairPath))[1];
    const wallet = await this.initWalletFromKeypair(keypair);
    const provider = new AnchorProvider(connection, wallet);

    const isMainnet = await isMainnetConnection(connection);
    const pid = isMainnet ? ON_DEMAND_MAINNET_PID : ON_DEMAND_DEVNET_PID;
    const program = await Program.at(pid, provider);

    return {
      rpcUrl: connection.rpcEndpoint,
      webSocketUrl: data.websocket_url,
      connection: connection,
      commitment: connection.commitment,
      keypairPath: keypairPath,
      keypair: keypair,
      provider: new AnchorProvider(connection, wallet),
      wallet: provider.wallet,
      program: program,
    };
  }

  /**
   * Parse out anchor events from the logs present in the program IDL.
   *
   * @param {Program} program - The Anchor program instance.
   * @param {string[]} logs - The array of logs to parse.
   * @returns {any[]} An array of parsed events.
   */
  static loggedEvents(program: Program, logs: string[]): any[] {
    const coder = new BorshEventCoder(program.idl);
    const out: any[] = [];
    logs.forEach((log) => {
      if (log.startsWith("Program data: ")) {
        const strings = log.split(" ");
        if (strings.length !== 3) return;
        try {
          out.push(coder.decode(strings[2]));
        } catch {}
      }
    });
    return out;
  }
}
