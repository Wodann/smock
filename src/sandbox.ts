import { VM } from '@nomicfoundation/ethereumjs-vm';
import { FactoryOptions } from '@nomiclabs/hardhat-ethers/types';
import { BaseContract, ContractFactory, ethers } from 'ethers';
import hre from 'hardhat';
import { ethersInterfaceFromSpec } from './factories/ethers-interface';
import { createFakeContract, createMockContractFactory } from './factories/smock-contract';
import { SMOCK_BUFFER } from './logic/programmable-function-logic';
import { ObservableVM } from './observable-vm';
import { FakeContract, FakeContractOptions, FakeContractSpec, MockContractFactory } from './types';
import { getHardhatBaseProvider, makeRandomAddress } from './utils';

// Handle hardhat ^2.19.0
let ExitCode: any;
try {
  ExitCode = require('hardhat/internal/hardhat-network/provider/vm/exit').ExitCode;
} catch (err) {
  ExitCode = require('@nomicfoundation/ethereumjs-evm/dist/exceptions').ERROR;
}

// Handle hardhat ^2.4.0
let decodeRevertReason: (value: Buffer) => string;
try {
  decodeRevertReason = require('hardhat/internal/hardhat-network/stack-traces/revert-reasons').decodeRevertReason;
} catch (err) {
  const { ReturnData } = require('hardhat/internal/hardhat-network/provider/return-data');
  decodeRevertReason = (value: Buffer) => {
    const returnData = new ReturnData(value);
    return returnData.isErrorReturnData() ? returnData.decodeError() : '';
  };
}

// Handle hardhat ^2.2.0
let TransactionExecutionError: any;
try {
  TransactionExecutionError = require('hardhat/internal/hardhat-network/provider/errors').TransactionExecutionError;
} catch (err) {
  TransactionExecutionError = require('hardhat/internal/core/providers/errors').TransactionExecutionError;
}

export class Sandbox {
  private vm: ObservableVM;
  private static nonce: number = 0;

  constructor(vm: VM) {
    this.vm = new ObservableVM(vm);
  }

  async fake<Type extends BaseContract>(spec: FakeContractSpec, opts: FakeContractOptions = {}): Promise<FakeContract<Type>> {
    return createFakeContract(
      this.vm,
      opts.address || makeRandomAddress(),
      await ethersInterfaceFromSpec(spec),
      opts.provider || hre.ethers.provider
    );
  }

  async mock<T extends ContractFactory>(
    contractName: string,
    signerOrOptions?: ethers.Signer | FactoryOptions
  ): Promise<MockContractFactory<T>> {
    return createMockContractFactory(this.vm, contractName, signerOrOptions);
  }

  static async create(): Promise<Sandbox> {
    // Only support native hardhat runtime, haven't bothered to figure it out for anything else.
    if (hre.network.name !== 'hardhat') {
      throw new Error(
        `Smock is only compatible with the "hardhat" network, got: ${hre.network.name}. Follow this issue for more info: https://github.com/defi-wonderland/smock/issues/29`
      );
    }

    const provider: any = await getHardhatBaseProvider(hre);
    const node = provider._node;

    // Initialize VM it case it hasn't been already
    if (node === undefined) {
      await provider._init();
    }

    // Here we're fixing with hardhat's internal error management. Smock is a bit weird and messes
    // with stack traces so we need to help hardhat out a bit when it comes to smock-specific errors.
    const originalManagerErrorsFn = node._manageErrors.bind(node);
    node._manageErrors = async (vmResult: any, vmTrace: any, vmTracerError?: any): Promise<any> => {
      const isRevert =
        // Versions before Hardhat 2.19.0
        (vmResult.exceptionError && vmResult.exceptionError.error === ExitCode.REVERT) ||
        // Versions after Hardhat 2.19.0
        (vmResult.exit && vmResult.exit.kind === ExitCode.REVERT);

      // Check whether the revert starts with the smock buffer, if so, it's a smock revert
      if (isRevert && SMOCK_BUFFER.compare(vmResult.returnValue, 0, SMOCK_BUFFER.length) === 0) {
        return new TransactionExecutionError(
          `VM Exception while processing transaction: revert ${decodeRevertReason(vmResult.returnValue.slice(SMOCK_BUFFER.length))}`
        );
      }

      return originalManagerErrorsFn(vmResult, vmTrace, vmTracerError);
    };

    return new Sandbox(provider._node._vm as VM);
  }

  static getNextNonce(): number {
    return Sandbox.nonce++;
  }
}
