// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// 0xeEcBc280F257f3Cb191E4b01fEedB61Cf42D5160
contract BaseCoin is ERC20 {
    constructor() ERC20("BaseCoin", "BASE") {
        _mint(msg.sender, 21000000 * 10 ** decimals());
    }
}
