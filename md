

1. Project Overview

Project Name: AirSense
Project Type: Real-Time Interactive 3D Indoor Environment Visualization
Domain: Indoor Air Quality • Smart Office • IoT-Ready • Data Visualization
Initial Data Source: Dummy/Simulated Data + Chennai Weather API
Future Data Source: Physical Environmental Sensors
Primary Platform: Web Application

2. Project Goal

Build an interactive real-time IT office environment that visualizes how outdoor Chennai weather, office occupancy, ventilation and indoor environmental conditions change over time.

The application will initially work without physical sensors.

It will use:

Chennai weather API data
Indoor-air-quality/API data where available
Dummy indoor data
User-adjustable office parameters
Simulation rules

Later, physical sensors can replace the dummy data without redesigning the application.

The main concept is:

Chennai Outdoor Environment
          ↓
Weather / AQI Data
          ↓
Indoor Environment Simulation
          ↓
People + Room + Ventilation
          ↓
CO₂ / O₂ / Temperature / Humidity
          ↓
Airflow Visualization
          ↓
Green / Yellow / Red Status
          ↓
Alerts + Recommendations
3. Important Scientific Principle

The system must not assume:

More people automatically means dangerous oxygen deficiency.

Instead, the primary relationship should be:

Occupancy
    +
Ventilation
    +
Room Characteristics
    ↓
CO₂ / Indoor Environmental Conditions

Outdoor weather should influence the simulation context but should not be treated as a direct measurement of indoor air quality.

The application is an environmental visualization and simulation system, not a medical diagnostic system.

4. Problem Statement

People working in offices spend significant amounts of time indoors.

Environmental conditions can change because of:

Number of people
Room size
Ventilation
AC operation
Outdoor temperature
Outdoor humidity
Outdoor air quality
Doors/windows
Time of day

Traditional dashboards show numbers but do not make the relationship between these factors easy to understand.

AirSense provides an interactive visual environment where users can change office conditions and immediately observe the simulated response.

5. Objectives
Primary Objectives
Display Chennai outdoor weather conditions.
Display available outdoor AQI information.
Create an interactive office environment.
Add adjustable numbers of people.
Simulate indoor CO₂.
Display oxygen as an environmental parameter.
Simulate indoor temperature.
Simulate indoor humidity.
Visualize ventilation.
Visualize airflow.
Show environmental status.
Display historical charts.
Provide alerts.
Provide recommendations.
Provide real-time simulation.
Prepare the architecture for future sensors.
6. Target Users
Employees

Understand office environmental conditions.

Facility Managers

Monitor:

Occupancy
CO₂
Temperature
Humidity
Ventilation
Air-quality trends
Administrators

Configure:

Rooms
People
Sensors
Thresholds
Simulation parameters
Demonstration Users

Use the application for:

Presentations
Training
Environmental awareness
Smart-office demonstrations
7. Core Product Concept

The application consists of:

External Environment
        ↓
Chennai Weather API
        ↓
Indoor Simulation Engine
        ↓
Office Environment
        ↓
People
        ↓
Environmental Parameters
        ↓
Risk / Status Engine
        ↓
3D Visualization
        ↓
Dashboard
8. Main Application Modes

The application should have three major modes.

Mode 1 — Chennai Live Mode

Uses external Chennai data.

Displays:

Outdoor temperature
Outdoor humidity
Wind
Weather condition
Outdoor AQI where available

This information becomes context for the indoor simulation.

Mode 2 — Simulation Mode

No physical sensors required.

User controls:

Number of people
Room dimensions
Ventilation
AC
Fresh-air input
Doors/windows
Initial CO₂
Initial temperature
Initial humidity
Simulation speed

The simulation engine calculates the changing indoor environment.

Mode 3 — Sensor Mode — Future

Physical sensors can be connected later.

ESP32
   ↓
CO₂ Sensor
Temperature Sensor
Humidity Sensor
   ↓
MQTT / HTTP
   ↓
Backend
   ↓
AirSense

The same dashboard and visualization should continue working.

9. Chennai Weather Integration

The application should retrieve current Chennai weather from a weather API.

Possible values:

Outdoor Temperature
Outdoor Humidity
Wind Speed
Wind Direction
Weather Condition
Pressure
Cloud Cover
Rain
UV Index

The API should be configurable through environment variables.

Example:

WEATHER_API_KEY
WEATHER_API_BASE_URL
WEATHER_LOCATION=Chennai
10. Outdoor AQI Integration

Where a reliable API is available, the application can retrieve:

AQI
PM2.5
PM10
NO₂
SO₂
CO
O₃

The application must distinguish:

Outdoor AQI
       ≠
Indoor AQI

Outdoor data can provide context for the indoor simulation.

11. Indoor Environment

The application should simulate an office environment containing:

Desks
Chairs
Laptops
Monitors
Employees
AC units
Ventilation outlets
Doors
Windows
Airflow
Environmental sensors/placeholders

Room dimensions must be configurable.

Example:

Room Width:   30 m
Room Length:  20 m
Room Height:   3 m

The user can change these values.

12. People Management

Users can dynamically change the number of people.

Example:

People

10 ─────────●──────── 100

Current: 45

Controls:

[ + Person ]
[ - Person ]

The system should also support:

Set People: 50

People should automatically appear/disappear inside the office.

13. People Positioning

Employees can be distributed throughout the office.

Example:

┌─────────────────────────────┐
│ 👤 👤      👤 👤     👤    │
│                             │
│ 👤      👤 👤      👤      │
│                             │
│    👤 👤       👤 👤      │
│                             │
│ 👤       👤      👤        │
└─────────────────────────────┘

Future functionality:

Drag employee
Move employee
Select employee
Move employee between zones
14. Employee Status Visualization

Employees should have an environmental status.

Green
🟢 NORMAL
Yellow
🟡 ATTENTION
Red
🔴 ALERT

The color represents environmental status.

It must not represent a medical diagnosis.

15. Environmental Parameters

The system should track:

Parameter	Unit
CO₂	ppm
O₂	%
Temperature	°C
Humidity	%
Ventilation	%
Airflow	m/s or simulation value
Occupancy	People
Outdoor Temperature	°C
Outdoor Humidity	%
Outdoor AQI	AQI
16. Indoor CO₂ Simulation

The simulation should consider:

Number of People
        +
Room Volume
        +
Ventilation
        +
Fresh-Air Rate
        +
Initial CO₂
        ↓
Simulated CO₂

Conceptual relationship:

People ↑
   ↓
CO₂ Generation ↑
   ↓
CO₂ Concentration ↑

But:

Ventilation ↑
   ↓
CO₂ Removal ↑
   ↓
CO₂ Concentration ↓
17. Indoor Temperature Simulation

Indoor temperature can be influenced by:

Outdoor temperature
Number of people
AC setting
Room size
Ventilation
Simulation time

Concept:

Outdoor Temperature
       +
Occupancy Heat
       -
AC Cooling
       -
Ventilation Effect
       ↓
Indoor Temperature
18. Indoor Humidity Simulation

Humidity can be influenced by:

Outdoor humidity
Ventilation
AC
Occupancy
Room conditions

The application should display the simulated value clearly as simulated data when it is not coming from a physical sensor.

19. Oxygen Visualization

Oxygen should be displayed as an environmental measurement/simulation.

Example:

O₂
20.8 %

The application should not artificially show dangerous oxygen depletion simply because occupancy increases.

If actual oxygen sensor data is unavailable, the value should be clearly marked:

O₂ — SIMULATED
20. Ventilation Controls

User-adjustable controls:

Ventilation
LOW ───────●──── HIGH

Fresh Air
LOW ─────●────── HIGH

AC
LOW ────────●── HIGH

Changing these controls should affect the simulation.

21. Door / Window Controls

Optional controls:

Main Door
[ OPEN / CLOSED ]

Windows
[ OPEN / CLOSED ]

Opening a window can increase simulated fresh-air exchange depending on the simulation configuration.

22. Airflow Visualization

Airflow should be represented using animated particles or arrows.

Example:

                 AIR OUT
                    ↑
→ → → → → → → → → →
→ → → → → → → → → →
→ → → → → → → → → →
                    ↑
                   AC

When ventilation changes:

Low ventilation
→ → →

High ventilation
→ → → → → → → →

This is a visual representation and should not be presented as a computational-fluid-dynamics simulation.

23. Real-Time Dashboard

Main dashboard:

┌─────────────────────────────────────┐
│          AIRSENSE LIVE              │
├─────────────────────────────────────┤
│                                     │
│ PEOPLE       45                     │
│ CO₂          920 ppm                │
│ O₂           20.8 %                 │
│ TEMP         24.8 °C                │
│ HUMIDITY     57 %                   │
│ VENTILATION  70 %                   │
│ AIRFLOW      NORMAL                 │
│                                     │
│ STATUS       🟡 ATTENTION           │
└─────────────────────────────────────┘
24. Chennai Outdoor Dashboard

Separate outdoor card:

CHENNAI OUTDOOR

Temperature: 32°C
Humidity:    72%
Wind:        18 km/h
Weather:     Cloudy
AQI:         Moderate

The source and timestamp should be shown.

Example:

Updated: 15:30 IST
Source: Weather API
25. Indoor vs Outdoor Comparison

A key feature should compare the environments.

             OUTDOOR       INDOOR

Temperature    32°C          24.8°C
Humidity       72%           57%
CO₂            Outdoor*      920 ppm
AQI            85            Simulated
Ventilation    Wind           70%

The UI must clearly identify which values are measured and which are simulated.

26. Live Simulation

The application should update automatically.

Example:

10:00
People: 20
CO₂: 620

       ↓

10:10
People: 35
CO₂: 800

       ↓

10:20
People: 50
CO₂: 1050

       ↓

10:30
People: 70
CO₂: 1350

The 3D environment, dashboard and charts should update together.

27. Simulation Speed

Controls:

0.5×
1×
2×
5×
10×

Example:

At 5×, one simulated hour can pass much faster than real time.

28. Scenario Controls
Scenario 1 — Normal Office
People: 25
Ventilation: 75%
AC: 60%
Status: Green
Scenario 2 — Increasing Occupancy
People:
20 → 40 → 60 → 80
Scenario 3 — Poor Ventilation
People: 50
Ventilation: 25%
CO₂: Increasing
Status: Yellow / Red
Scenario 4 — Improved Ventilation
Ventilation: 30% → 90%
CO₂: Decreasing
Status: Red → Yellow → Green
Scenario 5 — Reduced Occupancy
People:
80 → 60 → 40 → 20
29. Adjustable Room

Room parameters:

Width:      [ 30 m ]
Length:     [ 20 m ]
Height:     [ 3 m ]

Room Volume:
1800 m³

Changing room size should influence the simulation.

30. Zone System

The office can be divided into configurable zones.

Example:

┌────────────┬────────────┐
│ Zone A     │ Zone B     │
│ 🟢         │ 🟢         │
├────────────┼────────────┤
│ Zone C     │ Zone D     │
│ 🟡         │ 🔴         │
└────────────┴────────────┘

Each zone can have:

People
CO₂
Temperature
Humidity
Airflow
Ventilation
Status
31. Zone-Level People Adjustment

Example:

Zone A: 10 people
Zone B: 20 people
Zone C: 35 people
Zone D: 15 people

User can increase/decrease people per zone.

This creates a more realistic visualization than applying one value to the entire office.

32. Risk / Status Engine

The status engine receives:

CO₂
Temperature
Humidity
Ventilation
Occupancy
Airflow

and produces:

GREEN
YELLOW
RED

Thresholds must be configurable.

Example:

Environmental Data
       ↓
Threshold Rules
       ↓
Status Engine
       ↓
Zone Status
       ↓
Employee Visualization
33. Alerts

Example:

⚠ ENVIRONMENTAL ALERT

Zone C

CO₂: 1250 ppm
Occupancy: 35
Ventilation: 30%

Recommended:
Review ventilation conditions.

Another example:

⚠ TEMPERATURE ALERT

Indoor Temperature: 28.5°C

Recommended:
Review AC/ventilation settings.
34. Recommendation Engine

The system should provide practical environmental recommendations.

Examples:

High CO₂
→ Review outdoor-air ventilation.

High temperature
→ Review HVAC settings.

High occupancy
→ Review room capacity and ventilation.

Low airflow
→ Inspect ventilation distribution.

Outdoor AQI high
→ Consider appropriate fresh-air/HVAC strategy.

Recommendations should not claim to diagnose or prevent diseases.

35. Historical Analytics

Charts:

CO₂ vs Time
Occupancy vs Time
Temperature vs Time
Humidity vs Time
O₂ vs Time
Ventilation vs Time
Outdoor Temperature vs Time
Outdoor AQI vs Time
36. Correlation View

Show relationships such as:

Occupancy ↑
      ↓
CO₂ ↑
      ↓
Ventilation Requirement ↑

and:

Ventilation ↑
      ↓
CO₂ ↓
      ↓
Environmental Status Improves
37. Human Visualization

A separate educational human visualization can be included.

It can show:

NORMAL ENVIRONMENT
        ↓
Healthy-looking visualization

and:

POOR ENVIRONMENT
        ↓
Educational indicators

Possible indicators:

Eye irritation
Fatigue
Headache
Respiratory discomfort

These must be presented as possible effects, not medical diagnoses.

38. Animation Mode

The application should have a presentation mode.

Scene 1

Office starts with normal occupancy.

Scene 2

People enter.

Scene 3

Occupancy increases.

Scene 4

Environmental indicators change.

Scene 5

CO₂ graph rises.

Scene 6

Ventilation is increased.

Scene 7

Airflow becomes stronger.

Scene 8

Environmental indicators improve.

Scene 9

Recommendation appears.

39. Data Architecture

Use a common data-provider architecture.

                    DATA PROVIDERS
                         │
       ┌─────────────────┼─────────────────┐
       ↓                 ↓                 ↓
Dummy Provider      Weather API       Sensor Provider
       │                 │              Future
       └─────────────────┼─────────────────┘
                         ↓
                 Environment Engine
                         ↓
                    Application

This is one of the most important architectural decisions.

40. Dummy Data Provider

The initial implementation should use dummy data.

Example:

{
  "timestamp": "2026-08-21T15:30:00+05:30",
  "occupancy": 45,
  "co2": 920,
  "oxygen": 20.8,
  "temperature": 24.8,
  "humidity": 57,
  "ventilation": 70,
  "airflow": 0.45,
  "status": "yellow"
}

The data should change gradually rather than randomly jumping between values.

41. Weather API Provider

The application should have a separate weather service:

WeatherService
    ↓
getChennaiWeather()
    ↓
Outdoor Weather Object

Example:

{
  "location": "Chennai",
  "temperature": 32,
  "humidity": 72,
  "windSpeed": 18,
  "condition": "Cloudy",
  "timestamp": "..."
}
42. Future Sensor Provider

Later:

SensorService
    ↓
getIndoorReadings()
    ↓
Same Environment Object

The frontend should not care whether the data came from:

Dummy simulation
Weather API
Physical sensor
43. Backend Architecture

Recommended:

Frontend
React + TypeScript
        ↓
REST API / WebSocket
        ↓
Node.js / NestJS
        ↓
Environment Engine
        ↓
PostgreSQL

Future:

ESP32
 ↓
MQTT
 ↓
Backend
44. Frontend Technology

Recommended:

React
TypeScript
Vite
Tailwind CSS
Three.js
React Three Fiber
Drei
Recharts or ECharts

Three.js should handle:

Office
People
Desks
Airflow
Environment effects
Animations
45. Backend Technology

Recommended:

Node.js
NestJS
REST API
WebSocket
PostgreSQL
MQTT later
46. Database
rooms
id
name
width
length
height
capacity
created_at
zones
id
room_id
name
position
capacity
environment_readings
id
zone_id
co2
oxygen
temperature
humidity
airflow
ventilation
occupancy
timestamp
weather_readings
id
location
temperature
humidity
wind_speed
aqi
timestamp
simulation_sessions
id
scenario
start_time
end_time
speed
47. API Requirements
GET /api/weather/chennai

GET /api/rooms
POST /api/rooms

GET /api/zones
POST /api/zones

GET /api/environment/current
GET /api/environment/history

POST /api/simulation/start
POST /api/simulation/pause
POST /api/simulation/reset

POST /api/occupancy/update
POST /api/ventilation/update

GET /api/analytics/co2
GET /api/analytics/occupancy
48. WebSocket Events

For real-time updates:

environment:update
occupancy:update
weather:update
zone:update
airflow:update
status:update
alert:create
simulation:update
49. Real-Time Data Flow
Chennai Weather API
       ↓
Weather Service
       ↓
Outdoor Conditions
       ↓
Environment Simulation
       ↑
       │
People + Room + Ventilation
       ↓
Indoor Environment
       ↓
WebSocket
       ↓
React Application
       ↓
┌─────────────┬─────────────┬─────────────┐
│ 3D Office   │ Dashboard   │ Charts      │
└─────────────┴─────────────┴─────────────┘
50. Authentication

Future admin authentication:

Admin
Manager
Viewer

Permissions:

Role	View	Simulation	Configuration
Viewer	Yes	Limited	No
Manager	Yes	Yes	Limited
Admin	Yes	Yes	Yes
51. Performance Requirements

Target:

30–60 FPS for the 3D environment
Smooth employee animations
Real-time dashboard updates
Efficient chart rendering
No full-page reload for live updates

For large numbers of employees:

Instancing
Level of Detail
Animation reuse
Object pooling

should be considered.

52. Reliability

If weather API fails:

Weather API Offline
       ↓
Show last successful reading
       ↓
Display "Data unavailable/stale"

Do not pretend stale data is live data.

If dummy simulation is running:

Weather API Offline
       ↓
Simulation continues
53. Security

Required:

HTTPS
API authentication where required
Environment variables for API keys
Input validation
Rate limiting
Secure WebSocket connections
No API keys exposed in frontend code
54. Privacy

Do not collect unnecessary employee personal information.

Use anonymous simulated employees:

Person 001
Person 002
Person 003

The system is about environmental conditions, not employee health surveillance.

55. MVP Scope

The first version should include:

Interactive office
Adjustable room
Adjustable people
Dummy real-time data
Chennai weather API
Outdoor AQI integration where reliable
Indoor simulation
CO₂
O₂
Temperature
Humidity
Ventilation
Airflow
Green/Yellow/Red status
Dashboard
Charts
Alerts
Recommendations
Simulation controls

Do not implement physical sensors in MVP.

56. Phase 1
Foundation
Project setup
UI
Office environment
People
Room configuration
Dummy data provider
Environment engine
57. Phase 2
Real-Time Simulation
Live data updates
Occupancy controls
Ventilation controls
AC controls
Airflow
Status engine
Alerts
Charts
58. Phase 3
Chennai Integration
Weather API
Outdoor temperature
Outdoor humidity
Wind
Weather condition
Outdoor AQI
Outdoor/indoor comparison
59. Phase 4
Advanced Visualization
Zone system
Human visualization
Animation mode
Heatmap
Historical analytics
Scenario playback
60. Phase 5
Physical Sensors

Later integrate:

ESP32
+
NDIR CO₂ Sensor
+
Temperature/Humidity Sensor
        ↓
MQTT
        ↓
Backend
        ↓
Sensor Provider
        ↓
Existing Application

No major frontend rewrite should be required.

61. Success Criteria

The MVP is successful when a user can:

Open the application.
See the IT office.
See people inside the office.
Increase or decrease people.
Change room size.
Change ventilation.
Change AC.
See simulated CO₂ change.
See temperature/humidity change.
See airflow change.
See Green/Yellow/Red environmental status.
View live charts.
View Chennai outdoor weather.
View available outdoor AQI.
Compare indoor and outdoor conditions.
Run predefined scenarios.
Pause/reset the simulation.
Run the application without physical sensors.
Later connect physical sensors through the sensor-provider layer.
62. Key Differentiator

The application is not just a weather dashboard.

It combines:

CHENNAI WEATHER
       +
OUTDOOR AIR QUALITY
       +
OFFICE OCCUPANCY
       +
VENTILATION
       +
INDOOR ENVIRONMENT SIMULATION
       +
3D VISUALIZATION
       +
REAL-TIME ANALYTICS

This gives users a visual understanding of how external conditions and controllable office parameters interact.

63. Final Product Flow
              CHENNAI
                 │
        ┌────────┴────────┐
        ↓                 ↓
     WEATHER             AQI
        │                 │
        └────────┬────────┘
                 ↓
        OUTDOOR CONDITIONS
                 │
                 ↓
       ┌───────────────────┐
       │    IT OFFICE      │
       │                   │
       │ 👥 👥 👥 👥      │
       │                   │
       │ 👥 👥 👥 👥      │
       │                   │
       │ AC + VENTILATION  │
       └─────────┬─────────┘
                 ↓
        ENVIRONMENT ENGINE
                 ↓
       ┌─────────┼─────────┐
       ↓         ↓         ↓
      CO₂       TEMP      HUMIDITY
       ↓         ↓         ↓
       └─────────┼─────────┘
                 ↓
          STATUS ENGINE
                 ↓
        🟢    🟡    🔴
                 ↓
       DASHBOARD + 3D VIEW
                 ↓
        ALERT + RECOMMENDATION
64. One-Line Goal

AirSense is a real-time interactive 3D office environment that combines Chennai outdoor weather/AQI data with adjustable indoor occupancy and ventilation parameters to visualize changing indoor environmental conditions using simulation data today and physical sensors later.

65. Product Principle

Build the complete application with dummy data first → connect Chennai weather/AQI → validate the real-time experience → integrate physical sensors later.

This keeps the first version cost-effective, easier to develop, and easier to demonstrate. ten use this link and better mode iwant them 




https://sketchfab.com/3d-models/modern-office-interior-a95a81f32bb1461da296d1e2351e7093


https://sketchfab.com/3d-models/modern-office-interior-a95a81f32bb1461da296d1e2351e7093



then i want to controlled one human https://messenger.abeto.co/  baseon url i want them functionltiy realted to office air 




must used https://sketchfab.com/ all best model based on promt used then  used also lnk https://www.sidefx.com/industries/games/




