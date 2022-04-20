import '@nomiclabs/hardhat-ethers';

import Config from '../Config';
import { deployArtistImplementation, deployArtistProxy } from '../helpers';
import { buyEditionTests } from './buyEdition';
import { createEditionTests } from './createEdition';
import { deploymentTests } from './deployment';
import { endToEndTests } from './endToEnd';
import {
  checkTicketNumbersTests,
  contractURITests,
  editionCountTests,
  getApprovedTests,
  ownersOfTokenIdsTests,
  royaltyInfoTests,
  setPermissionedQuantityTests,
  setSignerAddressTests,
  totalSupplyTests,
  transferFromTests,
} from './others';
import { setEndTimeTests, setStartTimeTests } from './timing';
import { withdrawFundsTests } from './withdrawFunds';

describe('Artist prototype', () => {
  const config = new Config(deployArtistImplementation);
  testArtistContract(config);
});

describe('Artist proxy', () => {
  const config = new Config(deployArtistProxy);
  testArtistContract(config);
});

function testArtistContract(config: Config) {
  describe('deployment', () => {
    deploymentTests(config);
  });

  describe('createEdition', () => {
    createEditionTests(config);
  });

  describe('buyEdition', () => {
    buyEditionTests(config);
  });

  describe('withdrawFunds', () => {
    withdrawFundsTests(config);
  });

  describe('setStartTime', () => {
    setStartTimeTests(config);
  });

  describe('setEndTime', () => {
    setEndTimeTests(config);
  });

  describe('setSignerAddress', () => {
    setSignerAddressTests(config);
  });

  describe('setPermissionedQuantity', () => {
    setPermissionedQuantityTests(config);
  });

  describe('getApproved', () => {
    getApprovedTests(config);
  });

  describe('transferFrom', () => {
    transferFromTests(config);
  });

  describe('totalSupply', () => {
    totalSupplyTests(config);
  });

  describe('contractURI', () => {
    contractURITests(config);
  });

  describe('royaltyInfo', () => {
    royaltyInfoTests(config);
  });

  describe('editionCount', () => {
    editionCountTests(config);
  });

  describe('ownersOfTokenIds', () => {
    ownersOfTokenIdsTests(config);
  });

  describe('checkTicketNumbers', () => {
    checkTicketNumbersTests(config);
  });

  describe('end-to-end tests', () => {
    endToEndTests(config);
  });
}
