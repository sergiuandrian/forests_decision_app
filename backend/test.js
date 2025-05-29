const axios = require('axios');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // (atenție: dezactivează validarea SSL!)
const API_KEY = '3fe1a0f7-d9bc-4a50-8ada-b3d7f6b7b302';

const testGeojson = {
  type: 'Feature',
  geometry: {
    type: 'Polygon',
    coordinates: [[
      [28.8638, 47.0105],
      [28.8638, 47.2105],
      [29.0638, 47.2105],
      [29.0638, 47.0105],
      [28.8638, 47.0105]
    ]]
  }
};

async function testGeostore() {
  try {
    console.log('Testing GFW API...');
    const response = await axios.post(
      'https://api.globalforestwatch.org/geostore',
      { geojson: testGeojson },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY
        }
      }
    );
    console.log('Success:', response.data);
  } catch (error) {
    console.error('Error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
  }
}

testGeostore(); 