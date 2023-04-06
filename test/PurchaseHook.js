const { expect } = require("chai");
const { ethers, unlock } = require("hardhat");

describe("PurchaseHook", function () {
    let hook;
    let lockBasic, lockPremium, lockPro;

    before(async () => {
        // Deploy the core Unlock protocol
        await unlock.deployProtocol();
    });

    beforeEach(async function () {
        const [user] = await ethers.getSigners();

        // Deploy locks
        lockBasic = await unlock.createLock({
            expirationDuration: 60 * 60 * 24 * 7,
            maxNumberOfKeys: 100,
            keyPrice: "100000000000000000",
            name: "Basic",
        });

        lockPremium = await unlock.createLock({
            expirationDuration: 60 * 60 * 24 * 7,
            maxNumberOfKeys: 100,
            keyPrice: "500000000000000000",
            name: "Premium",
        });

        lockPro = await unlock.createLock({
            expirationDuration: 60 * 60 * 24 * 7,
            maxNumberOfKeys: 100,
            keyPrice: "1000000000000000000",
            name: "Pro",
        });

        // Contract Addreses
        const lockAddresses = [
            lockBasic.lock.address,
            lockPremium.lock.address,
            lockPro.lock.address,
        ];

        // Deploy the hook
        const PurchaseHook = await ethers.getContractFactory("PurchaseHook");
        const hook = await PurchaseHook.deploy(lockAddresses);
        await hook.deployed();


        // Attach the hook to all locks with lock manager role
        for (const lock of [lockBasic.lock, lockPremium.lock, lockPro.lock]) {
            const txGrantRole = await lock.addLockManager(hook.address);
            await txGrantRole.wait();

            const tx = await lock.setEventHooks(
                hook.address,
                ethers.constants.AddressZero,
                ethers.constants.AddressZero,
                ethers.constants.AddressZero,
                ethers.constants.AddressZero,
                ethers.constants.AddressZero,
                ethers.constants.AddressZero
            );
            await tx.wait();
        }


        this.user = user;
        this.hook = hook;
    });

    async function purchaseKey(user, lock, value) {
        const tx = await lock.purchase(
            [0],
            [user.address],
            [user.address],
            [user.address],
            [[]],
            { value: value }
        );
        await expect(tx.wait()).not.to.be.reverted;
        return tx;
    }


    // Helper function to count the number of valid keys a user has
    async function countValidKeys(userAddress) {
        let validKeys = 0;

        for (const lock of [lockBasic.lock, lockPremium.lock, lockPro.lock]) {
            const lockContract = await ethers.getContractAt("IPublicLockV12", lock.address);
            if (await lockContract.getHasValidKey(userAddress)) {
                validKeys += 1;
            }
        }

        return validKeys;
    }

    async function hasValidKeyForLock(userAddress, lock) {
        const lockContract = await ethers.getContractAt("IPublicLockV12", lock.address);
        return await lockContract.getHasValidKey(userAddress);
    }

    it("purchases should work", async function () {

        const keyPrice = await lockBasic.lock.keyPrice();

        const tx = await purchaseKey(this.user, lockBasic.lock, keyPrice);
        const receipt = await tx.wait();
        // const eventSignature = lockBasic.lock.interface.getSighash("OnKeyPurchaseDebug");
        // const event = receipt.events.find((e) => e.topics[0] === eventSignature);
        // if (event) {
        //     console.log("OnKeyPurchaseDebug event:");
        //     console.log(PurchaseHook.interface.decodeEventLog("OnKeyPurchaseDebug", event.data, event.topics));
        // }
        expect(await countValidKeys(this.user.address)).to.equal(1);
        expect(await hasValidKeyForLock(this.user.address, lockBasic.lock)).to.be.true;
        expect(await hasValidKeyForLock(this.user.address, lockPremium.lock)).to.be.false;
        expect(await hasValidKeyForLock(this.user.address, lockPro.lock)).to.be.false
    });



    // it("should handle upgrading to a more expensive key", async function () {
    //     const keyPrice = await lockBasic.lock.keyPrice();
    //     const tx = await purchaseKey(this.user, lockBasic.lock, keyPrice);
    //     const receipt = await tx.wait();

    //     await purchaseKey(this.user, lockBasic.lock, lockBasic.keyPrice);
    //     await purchaseKey(this.user, lockPremium.lock, lockPremium.keyPrice);
    //     expect(await countValidKeys(this.user.address)).to.equal(1);
    //     expect(await hasValidKeyForLock(this.user.address, lockBasic.lock)).to.be.false;
    //     expect(await hasValidKeyForLock(this.user.address, lockPremium.lock)).to.be.true;
    //     expect(await hasValidKeyForLock(this.user.address, lockPro.lock)).to.be.false;
    // });

    // it("should handle downgrading to a less expensive key", async function () {
    //     await purchaseKey(user, lockPro.lock, lockPro.keyPrice);
    //     await purchaseKey(user, lockBasic.lock, lockBasic.keyPrice);
    //     expect(await countValidKeys(user.address)).to.equal(1);
    //     expect(await hasValidKeyForLock(user.address, lockBasic.lock)).to.be.true;
    //     expect(await hasValidKeyForLock(user.address, lockPremium.lock)).to.be.false;
    //     expect(await hasValidKeyForLock(user.address, lockPro.lock)).to.be.false;

    // });

    // it("should handle purchasing a key of the same price", async function () {
    //     await purchaseKey(user, lockBasic.lock, lockBasic.keyPrice);
    //     await purchaseKey(luser, ockBasic.lock, lockBasic.keyPrice);
    //     expect(await countValidKeys(user.address)).to.equal(1);
    //     expect(await hasValidKeyForLock(user.address, lockBasic.lock)).to.be.true;
    //     expect(await hasValidKeyForLock(user.address, lockPremium.lock)).to.be.false;
    //     expect(await hasValidKeyForLock(user.address, lockPro.lock)).to.be.false;

    // });
});