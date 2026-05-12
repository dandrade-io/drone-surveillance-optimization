<script lang="ts">
	import { drawPolygon } from '$lib/draw_logic';
	import { onMount } from 'svelte';

	// import { onMount } from 'svelte';

	const inputClass = 'border rounded-sm h-8.5 mb-5 px-3';
	const labelClass = 'mb-1 font-normal text-lg';
	const cSize = 600;

	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D | null;
	let num_vertices: number | null = $state(null);
	let radius: number | null = $state(275);

	onMount(() => {
		ctx = canvas.getContext('2d');
	});

	function drawOnCanvas() {
		if (!ctx) return;

		ctx.clearRect(0, 0, canvas.width, canvas.height);

		if (num_vertices && radius) {
			drawPolygon(ctx, num_vertices, radius, canvas.height, canvas.width);
		}
	}
</script>

<div class="flex h-screen w-screen flex-col items-center bg-[#f8f8ff] p-5">
	<p class="mt-10 font-serif text-4xl font-normal">Drone Surveillance Optimization</p>
	<div class="mb-5 flex h-full w-full columns-2 items-center justify-center">
		<form class="mr-20 flex flex-col">
			<label for="num_sides_poly" class={labelClass}>No. of sides of the polygon</label>
			<input bind:value={num_vertices} type="number" id="num_sides_poly" class={inputClass} />

			<label for="circumradius" class={labelClass}>Circumradius value</label>
			<input bind:value={radius} type="number" id="circumradius" class={inputClass} />

			<label for="dron_radio" class={labelClass}>Drone radio</label>
			<input type="number" id="dron_radio" class={inputClass} />

			<label for="drone_velocity" class={labelClass}>Drone velocity</label>
			<input type="number" id="drone_velocity" class={inputClass} />

			<label for="prisoner_velocity" class={labelClass}>Prisoner velocity</label>
			<input type="number" id="prisoner_velocity" class={inputClass} />

			<button
				onclick={drawOnCanvas}
				class="mt-5 h-10 cursor-pointer rounded-sm bg-blue-500 text-lg font-medium text-white active:bg-blue-600"
				>Calculate
			</button>
		</form>
		<canvas bind:this={canvas} width={cSize} height={cSize} class="rounded-md border"></canvas>
	</div>
	<p class="text-gray-600">Made with ❤️ by Daniel Andrade & Brandon Mosquera</p>
</div>
