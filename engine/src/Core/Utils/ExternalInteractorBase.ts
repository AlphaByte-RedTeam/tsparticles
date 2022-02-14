import type { IDelta, IExternalInteractor } from "../Interfaces";
import type { Container } from "../Container";
import { InteractorType } from "../../Enums";
import type { Particle } from "../Particle";

export abstract class ExternalInteractorBase implements IExternalInteractor {
    protected constructor(protected readonly container: Container) {}

    type: InteractorType = InteractorType.External;

    public abstract interact(delta: IDelta): Promise<void>;

    abstract isEnabled(): boolean;

    abstract reset(particle: Particle): void;
}
