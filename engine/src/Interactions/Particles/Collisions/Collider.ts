import { CollisionMode, WorkerQueryType } from "../../../Enums";
import type { Container, Particle } from "../../../Core";
import { circleBounce, circleBounceDataFromParticle, clamp, getDistance } from "../../../Utils";
import type { Engine } from "../../../engine";
import { ParticlesInteractorBase } from "../../../Core";

function bounce(p1: Particle, p2: Particle): void {
    circleBounce(circleBounceDataFromParticle(p1), circleBounceDataFromParticle(p2));
}

function destroy(p1: Particle, p2: Particle): void {
    if (!p1.unbreakable && !p2.unbreakable) {
        bounce(p1, p2);
    }

    if (p1.getRadius() === undefined && p2.getRadius() !== undefined) {
        p1.destroy();
    } else if (p1.getRadius() !== undefined && p2.getRadius() === undefined) {
        p2.destroy();
    } else if (p1.getRadius() !== undefined && p2.getRadius() !== undefined) {
        if (p1.getRadius() >= p2.getRadius()) {
            p2.destroy();
        } else {
            p1.destroy();
        }
    }
}

/**
 * @category Interactions
 */
export class Collider extends ParticlesInteractorBase {
    readonly #engine;

    constructor(engine: Engine, container: Container) {
        super(container);

        this.#engine = engine;
    }

    isEnabled(particle: Particle): boolean {
        return particle.options.collisions.enable;
    }

    reset(): void {
        // do nothing
    }

    async interact(p1: Particle): Promise<void> {
        const container = this.container;
        const pos1 = p1.getPosition();

        const radius1 = p1.getRadius();

        const queryId = await this.#engine.queryTree(
            {
                containerId: container.treeId,
                position: pos1,
                queryId: "particles-collisions",
                queryType: WorkerQueryType.circle,
                radius: radius1 * 2,
            },
            (containerId, qid, ids) => {
                if (container.treeId !== containerId || queryId !== qid) {
                    return;
                }

                for (const id of ids) {
                    const p2 = container.particles.getParticle(id);

                    if (
                        !p2 ||
                        p1 === p2 ||
                        !p2.options.collisions.enable ||
                        p1.options.collisions.mode !== p2.options.collisions.mode ||
                        p2.destroyed ||
                        p2.spawning
                    ) {
                        continue;
                    }

                    const pos2 = p2.getPosition();

                    if (Math.round(pos1.z) !== Math.round(pos2.z)) {
                        continue;
                    }

                    const dist = getDistance(pos1, pos2);
                    const radius2 = p2.getRadius();
                    const distP = radius1 + radius2;

                    if (dist <= distP) {
                        this.resolveCollision(p1, p2);
                    }
                }
            }
        );
    }

    private resolveCollision(p1: Particle, p2: Particle): void {
        switch (p1.options.collisions.mode) {
            case CollisionMode.absorb: {
                this.absorb(p1, p2);
                break;
            }
            case CollisionMode.bounce: {
                bounce(p1, p2);
                break;
            }
            case CollisionMode.destroy: {
                destroy(p1, p2);
                break;
            }
        }
    }

    private absorb(p1: Particle, p2: Particle): void {
        const container = this.container;
        const fps = container.fpsLimit / 1000;

        if (p1.getRadius() === undefined && p2.getRadius() !== undefined) {
            p1.destroy();
        } else if (p1.getRadius() !== undefined && p2.getRadius() === undefined) {
            p2.destroy();
        } else if (p1.getRadius() !== undefined && p2.getRadius() !== undefined) {
            if (p1.getRadius() >= p2.getRadius()) {
                const factor = clamp(p1.getRadius() / p2.getRadius(), 0, p2.getRadius()) * fps;

                p1.size.value += factor;
                p2.size.value -= factor;

                if (p2.getRadius() <= container.retina.pixelRatio) {
                    p2.size.value = 0;
                    p2.destroy();
                }
            } else {
                const factor = clamp(p2.getRadius() / p1.getRadius(), 0, p1.getRadius()) * fps;

                p1.size.value -= factor;
                p2.size.value += factor;

                if (p1.getRadius() <= container.retina.pixelRatio) {
                    p1.size.value = 0;
                    p1.destroy();
                }
            }
        }
    }
}
