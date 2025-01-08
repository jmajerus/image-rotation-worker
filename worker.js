export default {
    async fetch(request, env) {
        return handleRequest(env, request);
    }
};

async function handleRequest(env, request) {
    const images = await fetchFlickrImages(env);

    if (images.length === 0) {
        return new Response(JSON.stringify({
            image: env.FALLBACK_IMAGE,
            title: "Fallback Image"
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // Get current index from KV Storage
    let currentIndex = parseInt(await env.KV_STORE.get('currentIndex')) || 0;

    const imageInfo = images[currentIndex];

    // Increment index and loop
    const newIndex = (currentIndex + 1) % images.length;
    await env.KV_STORE.put('currentIndex', newIndex.toString());

    return new Response(JSON.stringify(imageInfo), {
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-store'
        }
    });
}

// Fetch Flickr album and extract image URLs and titles
async function fetchFlickrImages(env) {
    const cache = caches.default;
    const cacheKey = new URL(`https://image-rotation-production.jmajerus.workers.dev/flickr-album-${env.FLICKR_ALBUM_ID}`);

    let response = await cache.match(cacheKey);
    if (response) {
        return await response.json();
    }

    const url = `https://www.flickr.com/services/rest/?method=flickr.photosets.getPhotos&api_key=${env.FLICKR_API_KEY}&photoset_id=${env.FLICKR_ALBUM_ID}&user_id=${env.FLICKR_USER_ID}&format=json&nojsoncallback=1`;

    try {
        response = await fetch(url);
        const data = await response.json();

        // Map photo data into image URL + title objects
        const imageInfos = data.photoset.photo.map(photo => ({
            image: `https://live.staticflickr.com/${photo.server}/${photo.id}_${photo.secret}_b.jpg`,
            title: photo.title
        }));

        // Cache the album with titles
        response = new Response(JSON.stringify(imageInfos), {
            headers: { 'Content-Type': 'application/json' }
        });
        response.headers.append('Cache-Control', 'max-age=86400');  // Cache for 1 day
        cache.put(cacheKey, response.clone());
        console.log(imageInfos);
        return imageInfos;
    } catch (error) {
        console.error('Error fetching Flickr images:', error);
        return [{ image: env.FALLBACK_IMAGE, title: "Fallback Image" }];
    }
}
