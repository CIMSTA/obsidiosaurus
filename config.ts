import { Config } from "old/types";

export let config: Config;

export function setSettings(settings: Config) {
	config = settings;
}
