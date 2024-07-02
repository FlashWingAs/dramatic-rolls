import soundEffectController from "./soundEffectController.js";
import { registerSettings } from "./settings.js";
import constants from "../constants.js";
import { initRollCollection } from "./rollCollector.js";
import { setupConfetti, fireConfetti } from "./confetti.js";

const socketName = `module.${constants.modName}`;

Hooks.on("init", () => {
   registerSettings();
   if (constants.debugMode) {
      CONFIG.debug.hooks = true;
   }
});

Hooks.on("ready", () => {
   initRollCollection();
   setupConfetti();

   if (game.settings.get(constants.modName, "add-confetti")) {
      game.socket.on(socketName, fireConfetti);
   }
});

export const handleEffects = (roll, isPublic = true) => {
   const shouldPlay =
      isPublic ||
      !game.settings.get(constants.modName, "trigger-on-public-only");
    const shouldBroadcastToOtherPlayers = isPublic;
    const summarizedDieRolls = getSummarizedDieRolls(roll);
    //const isCrit = determineIfCrit(summarizedDieRolls);
    //const isFumble = determineIfFumble(summarizedDieRolls);
    const numberOfCrits     = howManyCrit(summarizedDieRolls);
    const numberOfFumble    = howManyFumble(summarizedDieRolls);


    if (numberOfFumble > numberOfCrits) {
      roll = foundry.utils.mergeObject(roll, {
         soundEffect: soundEffectController.getFumbleSoundEffect(),
      });
   }

    if (numberOfCrits > numberOfFumble) {
      roll = foundry.utils.mergeObject(roll, {
         soundEffect: soundEffectController.getCritSoundEffect(),
      });
    }

/*    if (isCrit && isFumble) {
        if (numberOfCrits > numberOfFumble) {
            roll = foundry.utils.mergeObject(roll, {
                soundEffect: soundEffectController.getCritSoundEffect(),
            });
        }
        if (numberOfCrits < numberOfFumble) {
            roll = foundry.utils.mergeObject(roll, {
                soundEffect: soundEffectController.getFumbleSoundEffect(),
            });
        }
    }*/

    shouldPlay && (numberOfCrits > numberOfFumble) && handleConfetti(shouldBroadcastToOtherPlayers);
    shouldPlay &&
    game.settings.get(constants.modName, "add-sound") &&
    playSound(roll, shouldBroadcastToOtherPlayers);
};

const getIsRollOverrideCrit = (roll) => {
   if (
      game.system.id === "pf2e" &&
      game.settings.get(constants.modName, "pf2e-trigger-on-degree-of-success")
   ) {
      return roll.options?.degreeOfSuccess === 3;
   }
   return false;
};

const getIsRollOverrideFumble = (roll) => {
   if (
      game.system.id === "pf2e" &&
      game.settings.get(constants.modName, "pf2e-trigger-on-degree-of-success")
   ) {
      return roll.options?.degreeOfSuccess === 0;
   }
   return false;
};

const getSummarizedDieRolls = (rolls) => {
   const die = rolls.flatMap((roll) => {
      const d = roll.terms.filter((t) => t instanceof foundry.dice.terms.Die);
      const isOverrideCrit = getIsRollOverrideCrit(roll);
      const isOverrideFumble = getIsRollOverrideFumble(roll);
      return d.map((d) => ({ ...d, isOverrideCrit, isOverrideFumble }));
   });

   const results = die.flatMap((d) => {
      const faces = d?.faces ?? d?._faces;
      const results =
         d.results?.filter((r) => r.active)?.map((r) => r.result) ?? [];

      return results.map((r) => {
         return {
            faces: faces,
            result: r,
            isOverrideCrit: d.isOverrideCrit,
            isOverrideFumble: d.isOverrideFumble,
         };
      });
   });

   return results;
};

/*const determineIfCrit = (summarizedDieRolls) => {
   return !!(
      summarizedDieRolls
         .filter((r) => r.faces === 6)
         .some((r) => r.result === 6) ||
      summarizedDieRolls.some((r) => r.isOverrideCrit) ||
      constants.debugMode
   );
};

const determineIfFumble = (summarizedDieRolls) => {
   return !!(
      summarizedDieRolls
         .filter((r) => r.faces === 6)
         .some((r) => r.result === 1) ||
      summarizedDieRolls.some((r) => r.isOverrideFumble)
   );
};*/

const howManyCrit = (summarizedDieRolls) => {
    return (
        // --- r6 && r7 -> x1 ---
        summarizedDieRolls
            .filter((r) => r.faces === 6 || r.faces === 8 || r.faces === 10 || r.faces === 12).filter((r) => r.result >= 6 && r.result <8).length*1
        +
        // --- r8 && r9 -> x2 ---
        summarizedDieRolls
            .filter((r) => r.faces === 6 || r.faces === 8 || r.faces === 10 || r.faces === 12).filter((r) => r.result >= 8 && r.result < 10).length*2
        +
        // --- r10 && r11 -> x3 ---
        summarizedDieRolls
            .filter((r) => r.faces === 6 || r.faces === 8 || r.faces === 10 || r.faces === 12).filter((r) => r.result >= 10 && r.result < 12).length*3
        +
        // --- r12       -> x4 ---
        summarizedDieRolls
            .filter((r) => r.faces === 6 || r.faces === 8 || r.faces === 10 || r.faces === 12).filter((r) => r.result === 12).length*4
    );
};

const howManyFumble = (summarizedDieRolls) => {
    return (
        summarizedDieRolls
            .filter((r) => r.faces === 6).filter((r) => r.result === 1).length
        +
        summarizedDieRolls
            .filter((r) => r.faces === 8).filter((r) => r.result === 1).length
        +
        summarizedDieRolls
            .filter((r) => r.faces === 10).filter((r) => r.result === 1).length
        +
        summarizedDieRolls
            .filter((r) => r.faces === 12).filter((r) => r.result <= 2).length
    );
};

const playSound = (roll, broadcastSound) => {
   const soundEffect = roll.soundEffect;

   if (soundEffect && soundEffect.path) {
      soundEffectController.playSound(
         {
            src: soundEffect.path,
            volume: soundEffect.volume,
            autoplay: true,
            loop: false,
         },
         broadcastSound
      );
   }
};

const handleConfetti = (shouldBroadcastToOtherPlayers) => {
   if (game.settings.get(constants.modName, "add-confetti")) {
      fireConfetti();
   }

   if (shouldBroadcastToOtherPlayers) {
      game.socket.emit(socketName);
   }
};
