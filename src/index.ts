import { FactoryOptions } from '@nomiclabs/hardhat-ethers/types';
import { BaseContract, ContractFactory, ethers } from 'ethers';
import hre from 'hardhat';
import { matchers } from './chai-plugin/matchers';
import './chai-plugin/types';
import { Sandbox } from './sandbox';
import { FakeContract, FakeContractOptions, FakeContractSpec, MockContractFactory } from './types';
import { getHardhatBaseProvider } from './utils';

let sandbox: Sandbox;

async function fake<T extends BaseContract>(spec: FakeContractSpec, opts: FakeContractOptions = {}): Promise<FakeContract<T>> {
  if (!sandbox) await init();
  return await sandbox.fake(spec, opts);
}

async function mock<T extends ContractFactory>(
  contractName: string,
  signerOrOptions?: ethers.Signer | FactoryOptions
): Promise<MockContractFactory<T>> {
  if (!sandbox) await init();

  return await sandbox.mock(contractName, signerOrOptions);
}

async function init() {
  sandbox = await Sandbox.create();
}

export * from './types';
export const smock = { fake, mock, matchers };
