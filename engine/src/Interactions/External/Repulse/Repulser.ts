import { ClickMode, DivMode, DivType, HoverMode, WorkerQueryType } from "../../../Enums";
import { Constants, ExternalInteractorBase, IDimension, Vector } from "../../../Core";
import type { Container, ICoordinates } from "../../../Core";
import { calcEasing, clamp, divMode, divModeExecute, getDistances, isDivModeEnabled, isInArray } from "../../../Utils";
import type { DivEvent } from "../../../Options/Classes/Interactivity/Events/DivEvent";
import type { Engine } from "../../../engine";
import type { RepulseDiv } from "../../../Options/Classes/Interactivity/Modes/RepulseDiv";

/**
 * Particle repulse manager
 * @category Interactions
 */
export class Repulser extends ExternalInteractorBase {
    readonly #engine;

    constructor(engine: Engine, container: Container) {
        super(container);

        this.#engine = engine;
    }

    isEnabled(): boolean {
        const container = this.container,
            options = container.actualOptions,
            mouse = container.interactivity.mouse,
            events = options.interactivity.events,
            divs = events.onDiv,
            divRepulse = isDivModeEnabled(DivMode.repulse, divs);

        if (
            !(divRepulse || (events.onHover.enable && mouse.position) || (events.onClick.enable && mouse.clickPosition))
        ) {
            return false;
        }

        const hoverMode = events.onHover.mode,
            clickMode = events.onClick.mode;

        return isInArray(HoverMode.repulse, hoverMode) || isInArray(ClickMode.repulse, clickMode) || divRepulse;
    }

    reset(): void {
        // do nothing
    }

    async interact(): Promise<void> {
        const container = this.container,
            options = container.actualOptions,
            mouseMoveStatus = container.interactivity.status === Constants.mouseMoveEvent,
            events = options.interactivity.events,
            hoverEnabled = events.onHover.enable,
            hoverMode = events.onHover.mode,
            clickEnabled = events.onClick.enable,
            clickMode = events.onClick.mode,
            divs = events.onDiv;

        if (mouseMoveStatus && hoverEnabled && isInArray(HoverMode.repulse, hoverMode)) {
            await this.hoverRepulse();
        } else if (clickEnabled && isInArray(ClickMode.repulse, clickMode)) {
            await this.clickRepulse();
        } else {
            divModeExecute(DivMode.repulse, divs, (selector, div): void => this.singleSelectorRepulse(selector, div));
        }
    }

    private singleSelectorRepulse(selector: string, div: DivEvent): void {
        const container = this.container,
            query = document.querySelectorAll(selector);

        if (!query.length) {
            return;
        }

        query.forEach(async (item) => {
            const elem = item as HTMLElement,
                pxRatio = container.retina.pixelRatio,
                pos = {
                    x: (elem.offsetLeft + elem.offsetWidth / 2) * pxRatio,
                    y: (elem.offsetTop + elem.offsetHeight / 2) * pxRatio,
                },
                repulseRadius = (elem.offsetWidth / 2) * pxRatio,
                divs = container.actualOptions.interactivity.modes.repulse.divs,
                divRepulse = divMode(divs, elem);

            await this.processRepulse(
                pos,
                repulseRadius,
                div.type === DivType.circle ? WorkerQueryType.circle : WorkerQueryType.rectangle,
                div.type === DivType.circle
                    ? pos
                    : {
                          x: elem.offsetLeft * pxRatio,
                          y: elem.offsetTop * pxRatio,
                      },
                repulseRadius,
                {
                    width: elem.offsetWidth * pxRatio,
                    height: elem.offsetHeight * pxRatio,
                },
                divRepulse
            );
        });
    }

    private async hoverRepulse(): Promise<void> {
        const container = this.container,
            mousePos = container.interactivity.mouse.position;

        if (!mousePos) {
            return;
        }

        const repulseRadius = container.retina.repulseModeDistance;

        await this.processRepulse(mousePos, repulseRadius, WorkerQueryType.circle, mousePos, repulseRadius);
    }

    private async processRepulse(
        position: ICoordinates,
        repulseRadius: number,
        areaType: WorkerQueryType,
        areaPosition: ICoordinates,
        areaRadius?: number,
        areaSize?: IDimension,
        divRepulse?: RepulseDiv
    ): Promise<void> {
        const container = this.container,
            repulseOptions = container.actualOptions.interactivity.modes.repulse;

        //query = container.particles.quadTree.query(area)
        const queryId = await this.#engine.queryTree(
            {
                containerId: container.treeId,
                position: areaPosition,
                queryId: "external-repulse",
                queryType: areaType,
                radius: areaRadius,
                size: areaSize,
            },
            (containerId, qid, ids) => {
                if (container.treeId !== containerId || queryId !== qid) {
                    return;
                }

                for (const id of ids) {
                    const particle = container.particles.getParticle(id);

                    if (!particle) {
                        continue;
                    }

                    const { dx, dy, distance } = getDistances(particle.position, position),
                        velocity = (divRepulse?.speed ?? repulseOptions.speed) * repulseOptions.factor,
                        repulseFactor = calcEasing(1 - distance / repulseRadius, repulseOptions.easing) * velocity,
                        clamped =
                            repulseOptions.maxSpeed > 0
                                ? clamp(repulseFactor, 0, repulseOptions.maxSpeed)
                                : repulseFactor,
                        normVec = Vector.create(
                            !distance ? velocity : (dx / distance) * clamped,
                            !distance ? velocity : (dy / distance) * clamped
                        );

                    particle.position.addTo(normVec);
                }
            }
        );
    }

    private async clickRepulse(): Promise<void> {
        const container = this.container;

        if (!container.repulse.finish) {
            if (!container.repulse.count) {
                container.repulse.count = 0;
            }

            container.repulse.count++;

            if (container.repulse.count === container.particles.count) {
                container.repulse.finish = true;
            }
        }

        if (container.repulse.clicking) {
            const repulseDistance = container.retina.repulseModeDistance,
                repulseRadius = Math.pow(repulseDistance / 6, 3),
                mouseClickPos = container.interactivity.mouse.clickPosition;

            if (mouseClickPos === undefined) {
                return;
            }

            const queryId = await this.#engine.queryTree(
                {
                    containerId: container.treeId,
                    position: mouseClickPos,
                    queryId: "external-repulse-click",
                    queryType: WorkerQueryType.circle,
                    radius: repulseRadius,
                },
                (containerId, qid, ids) => {
                    if (container.treeId !== containerId || queryId !== qid) {
                        return;
                    }

                    for (const id of ids) {
                        const particle = container.particles.getParticle(id);

                        if (!particle) {
                            continue;
                        }

                        const { dx, dy, distance } = getDistances(mouseClickPos, particle.position),
                            d = distance ** 2,
                            velocity = container.actualOptions.interactivity.modes.repulse.speed,
                            force = (-repulseRadius * velocity) / d;

                        if (d <= repulseRadius) {
                            container.repulse.particles.push(particle);

                            const vect = Vector.create(dx, dy);

                            vect.length = force;

                            particle.velocity.setTo(vect);
                        }
                    }
                }
            );
        } else if (container.repulse.clicking === false) {
            for (const particle of container.repulse.particles) {
                particle.velocity.setTo(particle.initialVelocity);
            }
            container.repulse.particles = [];
        }
    }
}

/* Ready for a future release, breaking change. It's behavior seems more correct than the current.
export class Repulser implements IExternalInteractor {
    constructor(private readonly container: Container) {}

    public isEnabled(): boolean {
        const container = this.container;
        const options = container.options;

        const mouse = container.interactivity.mouse;
        const events = options.interactivity.events;
        const divs = events.onDiv;

        const divRepulse = isDivModeEnabled(DivMode.repulse, divs);

        if (
            !(divRepulse || (events.onHover.enable && mouse.position) || (events.onClick.enable && mouse.clickPosition))
        ) {
            return false;
        }

        const hoverMode = events.onHover.mode;
        const clickMode = events.onClick.mode;

        return (
            isInArray(HoverMode.repulse, hoverMode) || isInArray(ClickMode.repulse, clickMode) || divRepulse
        );
    }

    public reset(): void {
        // do nothing
    }

    public interact(): void {
        const container = this.container;
        const options = container.options;
        const mouseMoveStatus = container.interactivity.status === Constants.mouseMoveEvent;
        const events = options.interactivity.events;
        const hoverEnabled = events.onHover.enable;
        const hoverMode = events.onHover.mode;
        const clickEnabled = events.onClick.enable;
        const clickMode = events.onClick.mode;
        const divs = events.onDiv;

        if (mouseMoveStatus && hoverEnabled && isInArray(HoverMode.repulse, hoverMode)) {
            this.hoverRepulse();
        } else if (clickEnabled && isInArray(ClickMode.repulse, clickMode)) {
            this.clickRepulse();
        } else {
            divModeExecute(DivMode.repulse, divs, (selector, div): void => this.singleDivRepulse(selector, div));
        }
    }

    private singleDivRepulse(selector: string, div: DivEvent): void {
        const container = this.container;
        const query = document.querySelectorAll(selector);

        if (!query.length) {
            return;
        }

        query.forEach(item => {
                const elem = item as HTMLElement;
            const pxRatio = container.retina.pixelRatio;
            const pos = {
                x: (elem.offsetLeft + elem.offsetWidth / 2) * pxRatio,
                y: (elem.offsetTop + elem.offsetHeight / 2) * pxRatio,
            };
            const repulseRadius = (elem.offsetWidth / 2) * pxRatio;

            const area =
                div.type === DivType.circle
                    ? new Circle(pos.x, pos.y, repulseRadius)
                    : new Rectangle(
                    elem.offsetLeft * pxRatio,
                    elem.offsetTop * pxRatio,
                    elem.offsetWidth * pxRatio,
                    elem.offsetHeight * pxRatio
                    );

            const divs = container.options.interactivity.modes.repulse.divs;
            const divRepulse = divMode(divs, selector);
            const velocity = (divRepulse?.speed ?? container.options.interactivity.modes.repulse.speed) * 100;

            this.processRepulse(pos, repulseRadius, velocity, area, divRepulse);
        });
    }

    private hoverRepulse(): void {
        const container = this.container;
        const mousePos = container.interactivity.mouse.position;

        if (!mousePos) {
            return;
        }

        const repulseRadius = container.retina.repulseModeDistance;
        const velocity = container.options.interactivity.modes.repulse.speed * 100;

        this.processRepulse(mousePos, repulseRadius, velocity, new Circle(mousePos.x, mousePos.y, repulseRadius));
    }

    private clickRepulse(): void {
        const container = this.container;

        if (!container.repulse.finish) {
            if (!container.repulse.count) {
                container.repulse.count = 0;
            }

            container.repulse.count++;

            if (container.repulse.count === container.particles.count) {
                container.repulse.finish = true;
            }
        }

        if (container.repulse.clicking) {
            const mousePos = container.interactivity.mouse.clickPosition;

            if (!mousePos) {
                return;
            }

            const repulseRadius = container.retina.repulseModeDistance;
            const velocity = container.options.interactivity.modes.repulse.speed * 10;

            this.processRepulse(mousePos, repulseRadius, velocity, new Circle(mousePos.x, mousePos.y, repulseRadius));
        } else if (container.repulse.clicking === false) {
            container.repulse.particles = [];
        }
    }

    private processRepulse(
        position: ICoordinates,
        repulseRadius: number,
        velocity: number,
        area: Range,
        divRepulse?: RepulseDiv
    ): void {
        const container = this.container;
        const query = container.particles.quadTree.query(area);

        for (const particle of query) {
            const { dx, dy, distance } = getDistances(particle.position, position);
            const normVec = {
                x: dx / distance,
                y: dy / distance,
            };

            const repulseFactor = clamp((1 - Math.pow(distance / repulseRadius, 2)) * velocity, 0, 50);

            particle.position.x += normVec.x * repulseFactor;
            particle.position.y += normVec.y * repulseFactor;
        }
    }
}
 */
