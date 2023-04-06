pragma solidity ^0.8.0;

import "@unlock-protocol/contracts/dist/PublicLock/IPublicLockV12.sol";

contract PurchaseHook {
    event OnKeyPurchaseDebug(
        uint256 indexed tokenId,
        address indexed from,
        uint256 pricePaid,
        uint256 currentKeyPrice,
        uint256 keyExpirationTimestamp
    );

    // Lock Addresses
    address[] public lockAddresses;

    // Mapping to store the tokenId of a key owned by an address for each lock
    mapping(address => mapping(address => uint256)) public ownerToTokenId;

    /** Constructor */
    constructor(address[] memory _lockAddresses) {
        lockAddresses = _lockAddresses;
    }

    /**
     * Function that is called at the begining of the
     * `purchase` function on the Public Lock contract.
     * It is expected to return the price that has to be
     * paid by the purchaser (as a uint256). If this
     * reverts, the purchase function fails.
     */
    function keyPurchasePrice(
        address /* from */,
        address /*recipient */,
        address /* referrer */,
        bytes calldata /* data */
    ) external view returns (uint256 minKeyPrice) {
        return IPublicLockV12(msg.sender).keyPrice();
    }

    /**
     * Function that is called at the end of the `purchase`
     * function and that can be used to record and store
     * elements on the hook. Similarly, if this reverts, the
     * purchase function fails.
     */
    function onKeyPurchase(
        uint tokenId /*tokenId*/,
        address from /*from*/,
        address /*recipient*/,
        address /*referrer*/,
        bytes calldata /*data*/,
        uint256 /*minKeyPrice*/,
        uint256 pricePaid
    ) external {
        // Iterate through all lock addresses
        for (uint256 i = 0; i < lockAddresses.length; i++) {
            IPublicLockV12 lock = IPublicLockV12(lockAddresses[i]);

            // User has a previous key
            if (lock.getHasValidKey(from)) {
                uint256 currentKeyPrice = lock.keyPrice();
                uint256 currentTokenId = ownerToTokenId[from][lockAddresses[i]];

                // If the new key is more expensive, cancel and refund the old one (will refund depending on time remaining)
                // full price charged for the new key
                if (pricePaid >= currentKeyPrice) {
                    lock.expireAndRefundFor(currentTokenId, 0);
                } else {
                    // if new key is less expensive (downgrade)
                    uint256 keyExpirationTimestamp = lock
                        .keyExpirationTimestampFor(currentTokenId);

                    if (keyExpirationTimestamp > block.timestamp) {
                        uint256 remainingTime = lock.keyExpirationTimestampFor(
                            currentTokenId
                        ) - block.timestamp;
                        uint256 gracePeriod = 1 days; // Set a grace period to give time for the user to switch plans
                        if (remainingTime <= gracePeriod) {
                            // lock.expireAndRefundFor(currentTokenId, 0);
                        }
                    }
                }
            }
        }
        ownerToTokenId[from][msg.sender] = tokenId;
    }
}
