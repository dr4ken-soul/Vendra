import { Config } from '@remotion/cli/config';

/**
 * 1920x1080 at 30fps for 100 seconds.
 *
 * The frame rate matches the references' delivery format and the duration comes
 * from DIRECTION.md: 100s sits in the band the reference library uses for
 * repeated claim-evidence-verdict cycles, and the film has an argument with a
 * time component that a 56s compression would cut.
 */
Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
Config.setConcurrency(4);