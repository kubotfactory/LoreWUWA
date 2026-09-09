<template>
  <header
    class="relative flex min-h-[250px] flex-col items-center justify-center border-b border-[#1a202c] bg-cover bg-center px-5 text-center"
    style="
      height: 35vh;
      background-image: linear-gradient(to bottom, rgba(11, 14, 20, 0.4), #0b0e14),
        url('/image/banner/banner.jpg');
    "
  >
    <RouterLink to="/" class="block">
      <p class="mb-2.5 text-[clamp(0.75rem,1.5vw,0.9rem)] font-semibold uppercase tracking-[3px] text-accent">
        Wuthering Waves • Lore Archive
      </p>
      <h1
        class="font-display text-[clamp(2rem,5vw,3.5rem)] font-bold tracking-[2px] text-white"
        style="text-shadow: 0 0 15px rgba(251, 204, 39, 0.6)"
      >
        Tethys's Archive BY Ku-Bot Factory
      </h1>
    </RouterLink>
  </header>
</template>
