import React from 'react';
import SectionHeading from './SectionHeading';
import WeatherAgentCard from '@/components/weather/WeatherAgentCard';

/** Live Weather Agent demo: real airport forecast and weather risk from the backend. */
export default function LiveWeather() {
  return (
    <section id="weather" aria-labelledby="weather-title" className="scroll-mt-4">
      <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
        <SectionHeading
          id="weather-title"
          eyebrow="Live / Weather agent"
          aside="Hourly forecast, scored on the server."
          title="Airport weather,"
          accent="scored hourly."
          description="The Weather agent retrieves the hourly airport forecast and scores visibility, wind, gusts, precipitation and thunderstorms with the same deterministic rules the Risk agent uses."
        />
        <div className="mt-14">
          <WeatherAgentCard defaultAirport="CMB" />
        </div>
      </div>
    </section>
  );
}
