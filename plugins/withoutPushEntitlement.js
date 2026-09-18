const { withEntitlementsPlist } = require("@expo/config-plugins");

// expo-notifications se autolinkea (y su config plugin corre solo) por el
// solo hecho de estar instalado, sin importar si figura en el array
// "plugins" de app.json — y ese plugin siempre agrega `aps-environment`
// (para push remoto), que exige capability "Push Notifications" y no
// funciona con un team personal/gratuito de Apple. Esta app sólo usa
// notificaciones LOCALES (recordatorios en el dispositivo, sin servidor),
// que no necesitan ese entitlement — así que este plugin corre al final y
// lo saca.
module.exports = function withoutPushEntitlement(config) {
  return withEntitlementsPlist(config, (config) => {
    delete config.modResults["aps-environment"];
    return config;
  });
};
