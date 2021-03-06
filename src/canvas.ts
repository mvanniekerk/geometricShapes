(function main() {
	"use strict"
	const canvas = <HTMLCanvasElement> document.getElementById('canvas');
	const drawTypeSelectors = (<any>document.forms).drawType.elements.drawType;
	const ctx = <CanvasRenderingContext2D> canvas.getContext('2d');
	const shapeList = document.getElementById('shapes')!;
	const undoButton = document.getElementById('undo')!;

	type Maybe<T> = T | undefined;

	class Shape {
		checked: boolean;
		intersections: Point[];
		selected: boolean;
		color: string;
		constructor() {
			this.checked = true;
			this.intersections = [];
			this.selected = false;
			this.color = 'black';
		}
		draw() {
			throw new Error('abstract class shape for draw');
		}
		mouseInRange() : boolean {
			throw new Error('abstract class shape for mouse in range');
		}
		intersectLine(line: Line) : void {
			throw new Error('abstract class shape for intersect line');
		}
		intersectCircle(circle: Circle) : void {
			throw new Error('abstract class shape for intersect circle');
		}
		closestIntersectionPoints() : void {}
		removeSegment(shapes: Shape[]) : void {}
		genSegments() {};
	}
	

	class Circle extends Shape {
		center: Point;
		radius: number;
		redIntersectionPoints?: {lower: number, higher: number};
		constructor(center : Point, radius : number) {
			super();
			this.center = center;
			this.radius = radius;
		}

		draw() {
			let x = viewPort.findX(this.center.x);
			let y = viewPort.findY(this.center.y);
			let radius = this.radius * viewPort.zoomFactor;
			let start = 0;
			let end = 2*Math.PI;
			ctx.strokeStyle = this.color;
			ctx.beginPath();
			ctx.arc(x, y, radius, end, start);
			ctx.stroke();
		}

		mouseInRange() {
			let fromCenter = Math.hypot(this.center.x - user.x, this.center.y - user.y);
			let distance = Math.abs(fromCenter - this.radius);
			return distance <= radius
		}

		drawShapeSegment(points: {lower: number, higher: number}) {
			ctx.strokeStyle = 'red';
			ctx.beginPath();
			ctx.arc(this.center.x, this.center.y, this.radius, points.lower, points.higher);
			ctx.stroke();
			ctx.strokeStyle = 'black';
		}

		intersectLine(line : Line) : void{
			this.intersections.push(...circleLineIntersect(this, line));
		}
		
		// https://stackoverflow.com/questions/3349125/circle-circle-intersection-points 
		intersectCircle(c2: Circle) : void
		{
			let c1 = this;
			let d = Math.hypot(c1.center.x - c2.center.x, c1.center.y - c2.center.y);

			// TODO: handle edge case
			if (d > c1.radius + c2.radius || d < Math.abs(c1.radius - c2.radius)) {
				// circles are inside each other
				return; 
			} else if (d == 0 && c1.radius === c2.radius) {
				console.log('two circles are the same');
			}

			let a = (c1.radius*c1.radius - c2.radius*c2.radius + d*d) / (2*d);
			let h = Math.sqrt(c1.radius*c1.radius - a*a);
			let xm = c1.center.x + a*(c2.center.x - c1.center.x)/d;
			let ym = c1.center.y + a*(c2.center.y - c1.center.y)/d;

			let xs1 = xm + h*(c1.center.y - c2.center.y)/d;
			let xs2 = xm - h*(c1.center.y - c2.center.y)/d;

			let ys1 = ym - h*(c1.center.x - c2.center.x)/d;
			let ys2 = ym + h*(c1.center.x - c2.center.x)/d;

			this.intersections.push({x: xs1, y: ys1});
			this.intersections.push({x: xs2, y: ys2});
		}
	}

	class Line extends Shape {
		start: Point;
		end: Point;
		eraserSegment?: {start: Point, end: Point};
		segments?: {start: Point, end: Point}[];
		constructor(start: Point, end: Point) {
			super();
			this.start = start;
			this.end = end;
		}

		draw() {
			if (this.eraserSegment) {
				let lineSegment = this.eraserSegment;

				let startX = viewPort.findX(this.start.x); 
				let startY = viewPort.findY(this.start.y);
				let endX = viewPort.findX(lineSegment.start.x);
				let endY = viewPort.findY(lineSegment.start.y);
				ctx.beginPath();
				ctx.moveTo(startX, startY);
				ctx.lineTo(endX, endY);
				ctx.stroke();

				ctx.strokeStyle = 'red';
				startX = viewPort.findX(lineSegment.start.x);
				startY = viewPort.findY(lineSegment.start.y);
				endX = viewPort.findX(lineSegment.end.x);
				endY = viewPort.findY(lineSegment.end.y);
				ctx.beginPath();
				ctx.moveTo(startX, startY);
				ctx.lineTo(endX, endY);
				ctx.stroke();

				ctx.strokeStyle = 'black';
				startX = viewPort.findX(lineSegment.end.x);
				startY = viewPort.findY(lineSegment.end.y);
				endX = viewPort.findX(this.end.x);
				endY = viewPort.findY(this.end.y);
				ctx.beginPath();
				ctx.moveTo(startX, startY);
				ctx.lineTo(endX, endY);
				ctx.stroke();

				this.eraserSegment = undefined;
			} else {
				ctx.strokeStyle = this.color;
				let startX = viewPort.findX(this.start.x); 
				let startY = viewPort.findY(this.start.y);
				let endX = viewPort.findX(this.end.x);
				let endY = viewPort.findY(this.end.y);
				ctx.beginPath();
				ctx.moveTo(startX, startY);
				ctx.lineTo(endX, endY);
				ctx.stroke();
			}
		}

		removeSegment(shapes: Shape[]) : void {
			this.closestIntersectionPoints();
			if (this.eraserSegment) {
				if (this.start.x != this.eraserSegment.start.x || this.start.y != this.eraserSegment.start.y) {
					shapes.push(new Line(this.start, this.eraserSegment.start));
				}
				if (this.end.x != this.eraserSegment.end.x || this.end.y != this.eraserSegment.end.y) {
					shapes.push(new Line(this.eraserSegment.end, this.end));
				}
				for (let i=0; i<shapes.length; i++) {
					if (shapes[i] == this) {
						shapes.splice(i, 1);
						console.log(shapes);
					}
				}
				createShapeTexts(shapes);
			}
		}

		pointLineDistance(start: Point, end: Point, point: Point) : number {
			let v1 = end.y - start.y;
			let v2 = -(end.x - start.x);
			let r1 = start.x - point.x;
			let r2 = start.y - point.y;
			return Math.abs(-v2*r2-r1*v1)/Math.hypot(-v2, v1);
		}

		// http://mathworld.wolfram.com/Point-LineDistance2-Dimensional.html 
		mouseInRange() {
			let d = this.pointLineDistance(this.start, this.end, user);
			return inBetween(this.start, this.end, user) && d <= radius;
		}

		genSegments() : {start: Point, end: Point}[] {
			let points = this.intersections.slice(0, this.intersections.length);
			points.push(this.start);
			points.push(this.end);
			points.sort((a,b) => {
				if (a.x == b.x) {
					return a.y - b.y;
				} else {
					return a.x - b.x;
				}
			});
			let newSegments = [];
			for (let i = 1; i<points.length;i++) {
				let start = points[i-1];
				let end = points[i];
				newSegments.push({start, end});
			}
			this.segments = newSegments;
			return newSegments;
		}

		closestIntersectionPoints() : void {
			let lineSegments = this.genSegments();
			for (let lineSegment of lineSegments) {
				let start = lineSegment.start;
				let end = lineSegment.end;
				let startDist = Math.hypot(start.x - user.x, start.y - user.y);
				let endDist = Math.hypot(end.x - user.x, end.y - user.y);
				let dist = Math.hypot(start.x - end.x, start.y - end.y);
				if (startDist < dist && endDist < dist) {
					this.eraserSegment = lineSegment;
					return;
				}
			}
		}

		intersectLine(l2: Line) : void {
			var {start: p1, end: p2} = this;
			var {start: p3, end: p4} = l2;

			var a1 = (p1.y - p2.y) / (p1.x - p2.x);
			var a2 = (p3.y - p4.y) / (p3.x - p4.x);

			var b1 = p1.y - a1*p1.x;
			var b2 = p3.y - a2*p3.x;

			if (Math.abs(a1) > 1 << 28 && Math.abs(a2) < 1 << 28) {
				let result = {x: p1.x, y: p1.x*a2+b2};
				if (inBetween(p1, p2, result) && inBetween(p3, p4, result)) {
					this.intersections.push(result)
				}
				return;
			} else if (Math.abs(a1) < 1 << 28 && Math.abs(a2) > 1 << 28) {
				let result = {x: p3.x, y: p3.x*a1+b1};
				if (inBetween(p1, p2, result) && inBetween(p3, p4, result)) {
					this.intersections.push(result);
				}
				return;
			} else if (Math.abs(a1) > 1 << 28 && Math.abs(a2) > 1 << 28) {
				return;
			}

			var x = (b2 - b1)/(a1 - a2);
			var y = a2*x + b2;
			let result = {x, y};

			if (inBetween(p1, p2, result) && inBetween(p3, p4, result)) {
				this.intersections.push({x, y});
			}

		}

		intersectCircle(circle: Circle) : void {
			this.intersections.push(...circleLineIntersect(circle, this));
		}

	}

	interface Point {
		x: number; 
		y: number;
	}

	const user = {
		x: 0,
		y: 0,
		mouseDown: false,
		drawType: 'line'
	};

	const viewPort = {
		zoomFactor: 1,
		offsetX: 0,
		offsetY: 0,
		lastX: 0,
		lastY: 0,
		findX: function (x: number) {
			return x * this.zoomFactor + this.offsetX
		},
		findY: function (y: number) {
			return y * this.zoomFactor + this.offsetY
		}
	}


	for (let radio of drawTypeSelectors) {
		radio.onclick = function (e: MouseEvent) {
			user.drawType = radio.value;
		};

		if (radio.checked) {
			user.drawType = radio.value;
		}
	};

	const nodes: Point[] = [];
	const shapes: Shape[] = [];
	const radius = 5;
	const cWidth = 10000;
	const cHeight = 10000;

	function inBetween(p1: Point, p2: Point, p3:Point) {
		let d12 = Math.hypot(p1.x - p2.x, p1.y - p2.y);
		let d23 = Math.hypot(p2.x - p3.x, p2.y - p3.y);
		let d13 = Math.hypot(p1.x - p3.x, p1.y - p3.y);
		let diff = d13 + d23 - d12;

		let epsilon = 5;

		return -epsilon < diff && epsilon > diff;
	}

	// http://mathworld.wolfram.com/Circle-LineIntersection.html 
	function circleLineIntersect(circle: Circle, line: Line) : Point[]
	{
		let x1 = line.start.x - circle.center.x;
		let x2 = line.end.x - circle.center.x;
		let y1 = line.start.y - circle.center.y;
		let y2 = line.end.y - circle.center.y;
		let r = circle.radius;

		let dx = x2 - x1;
		let dy = y2 - y1;
		let dr = Math.hypot(dx, dy);
		let D = x1*y2 - x2*y1

		let sgn = (x: number) => x < 0 ? -1 : 1;
		let discr = r*r*dr*dr-D*D;

		if (discr < 0) {
			return [];
		} else if (discr == 0) {
			console.log('tangent line');
		}

		let xi1 = (D*dy + sgn(dy)*dx*Math.sqrt(discr)) / (dr*dr) + circle.center.x;
		let yi1 = (-D*dx + Math.abs(dy)*Math.sqrt(discr)) / (dr*dr) + circle.center.y;
		let p1 = {x: xi1, y: yi1};
		
		let xi2 = (D*dy - sgn(dy)*dx*Math.sqrt(discr)) / (dr*dr) + circle.center.x;
		let yi2 = (-D*dx - Math.abs(dy)*Math.sqrt(discr)) / (dr*dr) + circle.center.y;
		let p2 = {x: xi2, y: yi2};

		let result = [];

		if (inBetween(line.start, line.end, p1)) {
			result.push(p1);
		}

		if (inBetween(line.start, line.end, p2)) {
			result.push(p2);
		}

		return result;
	}


	function edges(p1: Point, p2: Point) : Line {
		var a = (p1.y - p2.y) / (p1.x - p2.x);
		if (isNaN(a)) { // horizontal line (initial state)
			return new Line({x: -cWidth, y: p1.y}, {x: cWidth, y: p1.y});
		} else if (Math.abs(a) > 1 << 28) { // vertical line
			let result = new Line({x: p1.x, y: -cHeight}, {x: p1.x, y: cHeight});
			return result;
		}
		var b = p1.y - a*p1.x;
		var end = a*cWidth + b;
		var start = a*-cWidth + b;

		return new Line({x: -cWidth, y: start}, {x: cWidth, y: end})
	}

	function pointInRange() : Maybe<Point> {
		for (let shape of shapes) {
			for (let intersection of shape.intersections) {
				let distance = Math.hypot(user.x - intersection.x, user.y - intersection.y);
				if (distance <= radius ) {
					return intersection;
				}
			}
		}
	}

	function shapeInRange() : Maybe<Shape> {
		for (let shape of shapes) {
			if (shape.mouseInRange()) {
				return shape;
			}
		}
		return;
	}

	undoButton.addEventListener("click", function (e) {
		if (shapeList.lastChild) {
			shapes.pop();
			shapeList.lastChild.remove();
			update();
		}
	});

	canvas.addEventListener("mousemove", function (e) {
		var rect = canvas.getBoundingClientRect();
		if (e.buttons != 2) { // not the right mouse button
			user.x = (e.clientX - rect.left - viewPort.offsetX) / viewPort.zoomFactor;
			user.y = (e.clientY - rect.top - viewPort.offsetY) / viewPort.zoomFactor;
		} else if (e.buttons == 2) { // right mouse button
			viewPort.offsetX += e.clientX - viewPort.lastX;
			viewPort.offsetY += e.clientY - viewPort.lastY;
		}
		viewPort.lastX = e.clientX;
		viewPort.lastY = e.clientY;
	});

	canvas.addEventListener("mousedown", function (e) {
		if (e.button == 2 || user.drawType == 'eraser') { // right mouse button
			return;
		}

		let minIntersection = pointInRange();

		if (minIntersection) {
			nodes.push(minIntersection);
		} else {
			nodes.push({x: user.x, y: user.y});
		}

		user.mouseDown = true;
	});

	canvas.addEventListener("contextmenu", function (e) {
		e.preventDefault();
	});

	canvas.addEventListener("mouseup", function (e) {
		if (e.button == 2 ) { // right mouse button
			return;
		} else if (user.drawType == 'eraser') {
			let shape = shapeInRange();
			if (shape) {
				shape.removeSegment(shapes);
				update();
			}
			return;
		}

		let minIntersection = pointInRange();

		if (minIntersection) {
			nodes.push(minIntersection);
		} else {
			nodes.push({x: user.x, y: user.y});
		}

		user.mouseDown = false;
	});

	canvas.addEventListener("wheel", function (e) {
		e.preventDefault();
		let delta = viewPort.zoomFactor * e.deltaY / 100;
		let zoomFactor = viewPort.zoomFactor + delta;
		if (zoomFactor >= 20 || zoomFactor <= 0.05) {
			return;
		}
		viewPort.zoomFactor = zoomFactor;
		viewPort.offsetX -= canvas.width / 2 * delta;
		viewPort.offsetY -= canvas.height / 2 * delta;
	});

	function createShapeText(name: String, id: number, shapes: Shape[]) {
		let newEl = document.createElement("li");
		let text = document.createTextNode(name + " " + id);
		newEl.onmouseenter = function () {
			shapes[id].color = 'red';
		}
		newEl.onmouseleave = function () {
			shapes[id].color = 'black';
		}

		var checkbox = document.createElement('input');
		checkbox.type = "checkbox";
		checkbox.checked = true;
		checkbox.onchange = function () {
			shapes[id].checked = checkbox.checked;
			update();
		}

		newEl.appendChild(text);
		newEl.appendChild(checkbox);
		shapeList.appendChild(newEl);
	}

	function createShapeTexts(shapes: Shape[]) {
		while (shapeList.lastChild) {
			shapeList.removeChild(shapeList.lastChild);
		}
		for (let i = 0; i < shapes.length; i++) {
			if (shapes[i] instanceof Circle) {
				createShapeText('circle', i, shapes);
			} else if (shapes[i] instanceof Line) {
				createShapeText('line', i, shapes);
			}
		}
	}

	function update() {
		if (nodes.length > 1) {
			let p1 = nodes.pop()!;
			let p2 = nodes.pop()!;

			let minIntersection = pointInRange();

			if (user.drawType === 'line') {
				let line;
				if (minIntersection) {
					line = edges(p2, minIntersection);
				} else {
					line = edges(p1, p2);
				}
				shapes.push(line);
				createShapeText('line', shapes.length - 1, shapes);
			} else if (user.drawType === 'circle') {
				let nodeRadius = Math.hypot(p1.x - p2.x, p1.y - p2.y);
				if (minIntersection) {
					nodeRadius = Math.hypot(p2.x - minIntersection.x, p2.y - minIntersection.y);
				}
				shapes.push(new Circle(p2, nodeRadius));
				createShapeText('circle', shapes.length - 1, shapes);
			}
		}

		for (let shape1 of shapes) {
			shape1.intersections = [];
			for (let shape2 of shapes){
				if (shape1 !== shape2) {
					if (shape1.checked && shape2.checked) {
						if (shape2 instanceof Line) {
							shape1.intersectLine(<Line> shape2);
						} else if (shape2 instanceof Circle) {
							shape1.intersectCircle(<Circle> shape2);
						}
					}
				}
			}
			if (shape1.intersections.length == 0 && shape1.checked) {
				console.log('no intersections', shape1);
			}
			shape1.genSegments();
		}
		console.log(shapes);
	}

	function newShape() {
		let minIntersection = pointInRange();

		if (user.drawType === 'line') {
			let line = edges(nodes[0], {x: user.x, y: user.y});
			if (minIntersection) {
				line = edges(nodes[0], minIntersection);
			}

			if (line !== null) {
				line.draw();
			}
		} else if (user.drawType === 'circle') {
			let node = nodes[0]
			let nodeRadius = Math.hypot(node.x - user.x, node.y - user.y);
			if (minIntersection) {
				nodeRadius = Math.hypot(node.x - minIntersection.x, node.y - minIntersection.y);
			}
			let circle = new Circle({x: node.x, y: node.y}, nodeRadius);
			circle.draw();

		}
	}

	function drawPoint(point: Point) : void {
			let x = viewPort.findX(point.x);
			let y = viewPort.findY(point.y);
			ctx.beginPath();
			ctx.arc(x, y, radius, 0, 2*Math.PI);
			ctx.fill();
	}

	function render() {
		if (nodes.length > 1) {
			update();
		}
		ctx.clearRect(0, 0, canvas.width, canvas.height);

		if (nodes.length === 1 && user.mouseDown) {
			newShape();
		}

		let minIntersection = pointInRange();

		if (minIntersection) {
			drawPoint(minIntersection);
		}

		let closeShape = shapeInRange();

		if (closeShape) {
			closeShape.selected = true;
			if (user.drawType === 'eraser') {
				closeShape.closestIntersectionPoints();
			} 
		}

		for (let shape of shapes) {
			if (shape.checked) {
				shape.draw();
			}
		}
		requestAnimationFrame(render);
	}

	render();

})();
