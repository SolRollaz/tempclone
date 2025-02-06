// import {
//   ChainController,
//   ConnectionController,
//   ConstantsUtil,
//   ModalController,
//   SIWXUtil,
//   StorageUtil,
// } from "@reown/appkit";
import { ChainController, ConnectionController } from "@reown/appkit-core";
import { ConstantsUtil as CommonConstantsUtil } from "@reown/appkit-common";

// -- Setup --------------------------------------------------------------------
const chain = CommonConstantsUtil.CHAIN.EVM;
const walletConnectUri = "wc://uri?=123";
const externalId = "coinbaseWallet";
const type = "WALLET_CONNECT";
const client = {
  connectWalletConnect: async (onUri) => {
    onUri(walletConnectUri);
    await Promise.resolve(walletConnectUri);
  },
  disconnect: async () => Promise.resolve(),
  signMessage: async (message) => Promise.resolve(message),
  estimateGas: async () => Promise.resolve(BigInt(0)),
  connectExternal: async (_id) => Promise.resolve(),
  checkInstalled: (_id) => true,
  parseUnits: (value) => BigInt(value),
  formatUnits: (value) => value.toString(),
  sendTransaction: () => Promise.resolve("0x"),
  writeContract: () => Promise.resolve("0x"),
  getEnsAddress: async (value) => Promise.resolve(value),
  getEnsAvatar: async (value) => Promise.resolve(value),
  getCapabilities: async () => Promise.resolve(""),
  grantPermissions: async () => Promise.resolve("0x"),
  revokePermissions: async () => Promise.resolve("0x"),
};
const partialClient = {
  connectWalletConnect: async () => Promise.resolve(),
  disconnect: async () => Promise.resolve(),
  estimateGas: async () => Promise.resolve(BigInt(0)),
  signMessage: async (message) => Promise.resolve(message),
  parseUnits: (value) => BigInt(value),
  formatUnits: (value) => value.toString(),
  sendTransaction: () => Promise.resolve("0x"),
  writeContract: () => Promise.resolve("0x"),
  getEnsAddress: async (value) => Promise.resolve(value),
  getEnsAvatar: async (value) => Promise.resolve(value),
  getCapabilities: async () => Promise.resolve(""),
  grantPermissions: async () => Promise.resolve("0x"),
  revokePermissions: async () => Promise.resolve("0x"),
};
const evmAdapter = {
  namespace: CommonConstantsUtil.CHAIN.EVM,
  connectionControllerClient: client,
};
const adapters = [evmAdapter];

ChainController.initialize(adapters, []);
ConnectionController.setClient(evmAdapter.connectionControllerClient);

ChainController.initialize(
  [
    {
      namespace: CommonConstantsUtil.CHAIN.EVM,
      connectionControllerClient: client,
      caipNetworks: [],
    },
  ],
  []
);

(async () => {
  await ConnectionController.connectWalletConnect();
  console.log(ConnectionController.state.wcUri);
})();
