import type { ICoordinates, IDimension } from "../Interfaces";
import { Circle } from "./Circle";
import { CircleWarp } from "./CircleWarp";
import type { Container } from "../Container";
import type { Point } from "./Point";
import type { Range } from "./Range";
import { Rectangle } from "./Rectangle";
import { getDistance } from "../../Utils";

/**
 * @category Utils
 */
export class QuadTree {
    readonly points: Point[];

    private northEast?: QuadTree;
    private northWest?: QuadTree;
    private southEast?: QuadTree;
    private southWest?: QuadTree;

    private divided;

    constructor(readonly rectangle: Rectangle, readonly capacity: number) {
        this.points = [];
        this.divided = false;
    }

    subdivide(): void {
        const x = this.rectangle.position.x;
        const y = this.rectangle.position.y;
        const w = this.rectangle.size.width;
        const h = this.rectangle.size.height;
        const capacity = this.capacity;

        this.northEast = new QuadTree(new Rectangle(x, y, w / 2, h / 2), capacity);
        this.northWest = new QuadTree(new Rectangle(x + w / 2, y, w / 2, h / 2), capacity);
        this.southEast = new QuadTree(new Rectangle(x, y + h / 2, w / 2, h / 2), capacity);
        this.southWest = new QuadTree(new Rectangle(x + w / 2, y + h / 2, w / 2, h / 2), capacity);
        this.divided = true;
    }

    insert(point: Point): boolean {
        if (!this.rectangle.contains(point.position)) {
            return false;
        }

        if (this.points.length < this.capacity) {
            this.points.push(point);

            return true;
        }

        if (!this.divided) {
            this.subdivide();
        }

        return (
            (this.northEast?.insert(point) ||
                this.northWest?.insert(point) ||
                this.southEast?.insert(point) ||
                this.southWest?.insert(point)) ??
            false
        );
    }

    queryCircle(position: ICoordinates, radius: number): number[] {
        return this.query(new Circle(position.x, position.y, radius));
    }

    queryCircleWarp(position: ICoordinates, radius: number, containerOrSize: Container | IDimension): number[] {
        const container = containerOrSize as Container;
        const size = containerOrSize as IDimension;

        return this.query(
            new CircleWarp(
                position.x,
                position.y,
                radius,
                container.canvas !== undefined ? container.canvas.size : size
            )
        );
    }

    queryRectangle(position: ICoordinates, size: IDimension): number[] {
        return this.query(new Rectangle(position.x, position.y, size.width, size.height));
    }

    query(range: Range, found?: number[]): number[] {
        const res = found ?? [];

        if (!range.intersects(this.rectangle)) {
            return [];
        } else {
            for (const p of this.points) {
                if (!range.contains(p.position) && getDistance(range.position, p.position) > p.radius) {
                    continue;
                }

                res.push(p.particleId);
            }

            if (this.divided) {
                this.northEast?.query(range, res);
                this.northWest?.query(range, res);
                this.southEast?.query(range, res);
                this.southWest?.query(range, res);
            }
        }

        return res;
    }
}
