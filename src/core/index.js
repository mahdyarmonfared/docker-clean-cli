/**
 * DockerClean-CLI Core API Barrel Module
 */

const dockerClient = require('./docker-client');
const sizeCalculator = require('./size-calculator');

module.exports = {
  ...dockerClient,
  ...sizeCalculator
};
