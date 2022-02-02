import { MoveDirection, OutMode } from "tsparticles";
import type { ISourceOptions } from "tsparticles";

export const options: ISourceOptions = {
    fpsLimit: 120,
    particles: {
        number: {
            value: 0,
        },
        color: {
            value: "random",
        },
        shape: {
            type: "circle",
        },
        opacity: {
            value: 0.3,
        },
        size: {
            value: 10,
            random: {
                enable: true,
                minimumValue: 5,
            },
        },
        move: {
            angle: {
                offset: 0,
                value: 30,
            },
            enable: true,
            speed: 15,
            direction: MoveDirection.top,
            random: false,
            straight: false,
            outModes: {
                default: OutMode.destroy,
            },
        },
    },
    detectRetina: true,
    background: {
        color: "#fff",
    },
    emitters: [
        {
            direction: MoveDirection.top,
            position: {
                y: 100,
            },
            life: {
                duration: 3,
                delay: 5,
                count: 0,
            },
        },
    ],
};
