// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// 0x690DfFd8B28E614f2A582c1FeDAF9ee316f8c93f
contract QuoteCoin is ERC20 {
    constructor() ERC20("QuoteCoin", "QUOTE") {
        _mint(msg.sender, 21000000 * 10 ** decimals());
    }
}
