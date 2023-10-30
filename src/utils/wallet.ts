import { Signer } from 'ethers';
import { ethers, network } from 'hardhat';

export const impersonate = async (address: string): Promise<Signer> => {
  await network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [address],
  });
  return ethers.provider.getSigner(address);
};
