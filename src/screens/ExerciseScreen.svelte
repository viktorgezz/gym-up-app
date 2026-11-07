<script lang="ts">
  import ExerciseStats from '../components/ExerciseStats.svelte';
  import NavBar from '../components/NavBar.svelte';
  import { app } from '../lib/app.svelte';
  import ExerciseForm from '../sheets/ExerciseForm.svelte';

  let { id }: { id: string } = $props();

  const exercise = $derived(app.exerciseById.get(id));
  let editing = $state(false);
</script>

{#if exercise}
  <NavBar>
    {#snippet actions()}
      <button class="link" onclick={() => (editing = true)}>Изменить</button>
    {/snippet}
  </NavBar>

  <div class="screen with-nav">
    <h1 class="large-title">{exercise.name}</h1>
    <ExerciseStats {exercise} />
  </div>

  {#if editing}
    <ExerciseForm {exercise} onclose={() => (editing = false)} />
  {/if}
{/if}
