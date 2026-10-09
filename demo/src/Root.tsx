import React from 'react';
import { Composition } from 'remotion';
import { VendraFilm, FILM_LENGTH } from './film';
import { FPS } from './theme';

/**
 * 100 seconds at 30fps, 1920x1080.
 *
 * The duration is derived from the beat table rather than typed in, so a beat
 * cannot be resized without the composition following it.
 */
export const RemotionRoot: React.FC = () => (
  <Composition
    id="VendraFilm"
    component={VendraFilm}
    durationInFrames={FILM_LENGTH}
    fps={FPS}
    width={1920}
    height={1080}
  />
);