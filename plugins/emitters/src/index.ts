import type { IOptions, IPlugin, Options, RecursivePartial } from "tsparticles-engine";
import { CircleShape } from "./Shapes/Circle/CircleShape";
import { Emitter } from "./Options/Classes/Emitter";
import { EmitterClickMode } from "./Enums/EmitterClickMode";
import type { EmitterContainer } from "./EmitterContainer";
import { EmitterShapeType } from "./Enums/EmitterShapeType";
import { Emitters } from "./Emitters";
import type { EmittersEngine } from "./EmittersEngine";
import type { IEmitter } from "./Options/Interfaces/IEmitter";
import type { IEmitterModeOptions } from "./Options/Interfaces/IEmitterModeOptions";
import type { IEmitterOptions } from "./Options/Interfaces/IEmitterOptions";
import type { IEmitterShape } from "./IEmitterShape";
import { ShapeManager } from "./ShapeManager";
import { SquareShape } from "./Shapes/Square/SquareShape";
import { isInArray } from "tsparticles-engine";

/**
 * @category Emitters Plugin
 */
class EmittersPlugin implements IPlugin {
    readonly #engine;
    readonly id;

    constructor(engine: EmittersEngine) {
        this.#engine = engine;
        this.id = "emitters";
    }

    getPlugin(container: EmitterContainer): Emitters {
        return new Emitters(this.#engine, container);
    }

    loadOptions(options: Options, source?: RecursivePartial<IOptions & IEmitterOptions>): void {
        if (!this.needsPlugin(options) && !this.needsPlugin(source)) {
            return;
        }

        const optionsCast = options as unknown as IEmitterOptions;

        if (source?.emitters) {
            if (source?.emitters instanceof Array) {
                optionsCast.emitters = source?.emitters.map((s) => {
                    const tmp = new Emitter();

                    tmp.load(s);

                    return tmp;
                });
            } else {
                let emitterOptions = optionsCast.emitters as Emitter;

                if (emitterOptions?.load === undefined) {
                    optionsCast.emitters = emitterOptions = new Emitter();
                }

                emitterOptions.load(source?.emitters);
            }
        }

        const interactivityEmitters = source?.interactivity?.modes?.emitters;

        if (interactivityEmitters) {
            if (interactivityEmitters instanceof Array) {
                optionsCast.interactivity.modes.emitters = {
                    random: {
                        count: 1,
                        enable: true,
                    },
                    value: interactivityEmitters.map((s) => {
                        const tmp = new Emitter();

                        tmp.load(s);

                        return tmp;
                    }),
                };
            } else {
                const emitterMode = interactivityEmitters as IEmitterModeOptions;

                if (emitterMode.value !== undefined) {
                    if (emitterMode.value instanceof Array) {
                        optionsCast.interactivity.modes.emitters = {
                            random: {
                                count: emitterMode.random.count ?? 1,
                                enable: emitterMode.random.enable ?? false,
                            },
                            value: emitterMode.value.map((s) => {
                                const tmp = new Emitter();

                                tmp.load(s);

                                return tmp;
                            }),
                        };
                    } else {
                        const tmp = new Emitter();

                        tmp.load(emitterMode.value);

                        optionsCast.interactivity.modes.emitters = {
                            random: {
                                count: emitterMode.random.count ?? 1,
                                enable: emitterMode.random.enable ?? false,
                            },
                            value: tmp,
                        };
                    }
                } else {
                    const emitterOptions = (optionsCast.interactivity.modes.emitters = {
                        random: {
                            count: 1,
                            enable: false,
                        },
                        value: new Emitter(),
                    });

                    emitterOptions.value.load(interactivityEmitters as IEmitter);
                }
            }
        }
    }

    needsPlugin(options?: RecursivePartial<IOptions & IEmitterOptions>): boolean {
        if (!options) {
            return false;
        }

        const emitters = options.emitters;

        return (
            (emitters instanceof Array && !!emitters.length) ||
            emitters !== undefined ||
            (!!options.interactivity?.events?.onClick?.mode &&
                isInArray(EmitterClickMode.emitter, options.interactivity.events.onClick.mode))
        );
    }
}

export async function loadEmittersPlugin(engine: EmittersEngine): Promise<void> {
    if (!engine.emitterShapeManager) {
        engine.emitterShapeManager = new ShapeManager(engine);
    }

    if (!engine.addEmitterShape) {
        engine.addEmitterShape = (name: string, shape: IEmitterShape): void => {
            engine.emitterShapeManager?.addShape(name, shape);
        };
    }

    const plugin = new EmittersPlugin(engine);

    await engine.addPlugin(plugin);

    engine.addEmitterShape(EmitterShapeType.circle, new CircleShape());
    engine.addEmitterShape(EmitterShapeType.square, new SquareShape());
}

export * from "./EmitterContainer";
export * from "./EmittersEngine";
export * from "./Enums/EmitterClickMode";
export * from "./Enums/EmitterShapeType";
export * from "./Options/Interfaces/IEmitterOptions";
export type { IEmitterModeOptions } from "./Options/Interfaces/IEmitterModeOptions";
