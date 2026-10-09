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
          eyebrow="Airport weather"
          aside="Hourly forecasts"
          title="Airport weather,"
          accent="at a glance."
          description="Forecasts for your airport, with weather conditions that could affect your flight."
        />
        <div className="mt-14">
          <WeatherAgentCard defaultAirport="CMB" />
        </div>
      </div>
    </section>
  );
}
