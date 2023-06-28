import { Config } from 'src/types'

export let config: Config;

export function setSettings(settings: Config) {
  config = settings;
}
