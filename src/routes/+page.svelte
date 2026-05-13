<script lang="ts">
	import { animateDrones, animatePrisioners, drawCircle, drawPolygon } from '$lib/draw_logic';
	import { resolveCircle, type ProblemParams } from '$lib/linear_programming';

	import { onMount } from 'svelte';

	const inputClass = 'border rounded-sm h-8.5 mb-5 px-3';
	const labelClass = 'mb-1 font-normal text-lg';
	const cSize = 615;
	const options = [
		{ id: '1', label: 'Circle' },
		{ id: '2', label: 'Polygon' }
	];

	let bCanvas: HTMLCanvasElement;
	let pCanvas: HTMLCanvasElement;
	let dCanvas: HTMLCanvasElement;
	let bCtx: CanvasRenderingContext2D;
	let pCtx: CanvasRenderingContext2D;
	let dCtx: CanvasRenderingContext2D;
	let cancelPrisionersAnimation: (() => void) | null = null;
	let cancelDronesAnimation: (() => void) | null = null;

	let num_vertices: number | null = $state(5);
	let radius: number | null = $state(275);
	let num_slots: number | null = $state(10);
	let droneSpeed: number | null = $state(20);
	let prisonerSpeed: number | null = $state(10);
	let optionSelectedId = $state(options[1].id);

	onMount(() => {
		let context = bCanvas.getContext('2d');
		if (context) bCtx = context;

		context = pCanvas.getContext('2d');
		if (context) pCtx = context;

		context = dCanvas.getContext('2d');
		if (context) dCtx = context;
	});

	function drawOnCanvas() {
		cancelPrisionersAnimation?.();
		cancelDronesAnimation?.();

		if (!radius) return;
		if (!prisonerSpeed) return;

		if (droneSpeed && num_slots) {
			let _droneRadius: number = radius / 2;
			let apothem: number = radius;

			if (optionSelectedId === '2') {
				apothem = radius * Math.cos(Math.PI / num_vertices!);
				_droneRadius = apothem / 2;
			}

			const params: ProblemParams = {
				R: optionSelectedId === '2' ? apothem : radius,
				vp: prisonerSpeed,
				vd: droneSpeed,
				rd: _droneRadius,
				rv: _droneRadius,
				n: num_slots
			};

			const droneRadians: number[] = resolveCircle(params);
			console.log(droneRadians);

			cancelDronesAnimation = animateDrones(
				droneSpeed,
				_droneRadius,
				droneRadians,
				dCtx,
				bCanvas.height,
				bCanvas.width
			);
		}

		cancelPrisionersAnimation = animatePrisioners(
			prisonerSpeed,
			radius,
			pCtx,
			bCanvas.height,
			bCanvas.width
		);
	}

	$effect(() => {
		const n: number | null = num_vertices;
		const r: number | null = radius;

		cancelPrisionersAnimation?.();
		cancelDronesAnimation?.();

		if (optionSelectedId == '1' && r) {
			bCtx.clearRect(0, 0, bCanvas.width, bCanvas.height);
			drawCircle(bCtx, r, bCanvas.height, bCanvas.width);
			return;
		}

		const timer = setTimeout(() => {
			bCtx.clearRect(0, 0, bCanvas.width, bCanvas.height);
			if (n && r) drawPolygon(bCtx, n, r, bCanvas.height, bCanvas.width);
		}, 250);

		return () => clearTimeout(timer);
	});
</script>

<div class="flex h-screen w-screen flex-col items-center bg-[#f8f8ff] p-5">
	<p class="mt-6 font-serif text-4xl font-normal">Drone Surveillance Optimization</p>
	<div class="my-12 flex h-full w-full columns-2 justify-center">
		<form class="mr-24 flex flex-col">
			{#each options as option (option.id)}
				<label
					class="mb-2 flex cursor-pointer items-center gap-2 text-lg font-normal hover:bg-slate-50"
				>
					<input
						type="radio"
						name="drone-selection"
						value={option.id}
						bind:group={optionSelectedId}
						class="size-4"
					/>
					<span>{option.label}</span>
				</label>
			{/each}

			<div class="mt-3"></div>

			{#if optionSelectedId == '2'}
				<label for="num_sides_poly" class={labelClass}>No. of sides of the polygon</label>
				<input bind:value={num_vertices} type="number" id="num_sides_poly" class={inputClass} />
			{/if}

			<label for="num_slots" class={labelClass}>No. of slots</label>
			<input bind:value={num_slots} type="number" id="num_slots" class={inputClass} />

			<label for="circumradius" class={labelClass}>Circumradius value</label>
			<input bind:value={radius} type="number" id="circumradius" class={inputClass} />

			<label for="drone_speed" class={labelClass}>Drone speed (pix/sec)</label>
			<input bind:value={droneSpeed} type="number" id="drone_speed" class={inputClass} />

			<label for="prisoner_speed" class={labelClass}>Prisoner speed (pix/sec)</label>
			<input bind:value={prisonerSpeed} type="number" id="prisoner_speed" class={inputClass} />

			<button
				onclick={drawOnCanvas}
				class="mt-5 h-10 cursor-pointer rounded-sm bg-blue-500 text-lg font-medium text-white active:bg-blue-600"
				>Calculate
			</button>
		</form>

		<div class="relative size-153.75 rounded-md border">
			<canvas bind:this={bCanvas} width={cSize} height={cSize} class="absolute z-0"></canvas>
			<canvas bind:this={dCanvas} width={cSize} height={cSize} class="absolute z-1"></canvas>
			<canvas bind:this={pCanvas} width={cSize} height={cSize} class="absolute z-2"></canvas>
		</div>
	</div>
	<p class="text-gray-600">Made with ❤️ by Daniel Andrade & Brandon Mosquera</p>
</div>
