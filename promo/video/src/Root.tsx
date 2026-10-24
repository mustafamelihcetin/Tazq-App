import React from "react";
import { Composition } from "remotion";
import { Film, buildFilm, buildPlay } from "./scenes/Film";
import { AppPreview, PREVIEW_TOTAL } from "./scenes/AppPreview";
import { FPS } from "./theme";

export const RemotionRoot: React.FC = () => (
  <>
    {(["tr", "en"] as const).map((lang) => (
      <React.Fragment key={lang}>
        <Composition
          id={`Film-${lang}`}
          component={Film}
          durationInFrames={buildFilm(lang).total}
          fps={FPS}
          width={1920}
          height={1080}
          defaultProps={{ lang, variant: "film" as const }}
        />
        <Composition
          id={`Play-${lang}`}
          component={Film}
          durationInFrames={buildPlay().total}
          fps={FPS}
          width={1920}
          height={1080}
          defaultProps={{ lang, variant: "play" as const }}
        />
        <Composition
          id={`AppStore-${lang}`}
          component={AppPreview}
          durationInFrames={PREVIEW_TOTAL}
          fps={FPS}
          width={886}
          height={1920}
          defaultProps={{ lang }}
        />
        <Composition
          id={`AppStoreIpad-${lang}`}
          component={AppPreview}
          durationInFrames={PREVIEW_TOTAL}
          fps={FPS}
          width={1200}
          height={1600}
          defaultProps={{ lang }}
        />
      </React.Fragment>
    ))}
  </>
);
