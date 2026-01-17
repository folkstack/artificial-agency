// --- START OF FILE memoryBank.js ---

const memoryBank = (() => {
    const STORAGE_KEY = 'renderMemoryBank_Metadata_v2';
    const PIXEL_DATA_DIR_NAME = 'renderMemoryBank_PixelData';
    const DB_NAME = 'MemoryBankFsaDB';
    const DB_VERSION = 1;
    const HANDLE_STORE_NAME = 'fsaHandles';
    const HANDLE_KEY = 'directoryHandle'; // Fixed key to store the single handle

    let _directoryHandle = null;
    let _initialCleanupPerformed = false;
    let _dbPromise = null; // Promise for the IndexedDB connection

    // --- IndexedDB Helper Functions ---

    const _openDB = () => {
        if (_dbPromise) return _dbPromise; // Return existing promise if available

        _dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = (event) => {
                console.error("IndexedDB error:", request.error);
                reject(`IndexedDB error: ${request.error}`);
            };

            request.onsuccess = (event) => {
                console.log("IndexedDB opened successfully.");
                resolve(event.target.result);
            };

            request.onupgradeneeded = (event) => {
                console.log("IndexedDB upgrade needed.");
                const db = event.target.result;
                if (!db.objectStoreNames.contains(HANDLE_STORE_NAME)) {
                    console.log(`Creating object store: ${HANDLE_STORE_NAME}`);
                    db.createObjectStore(HANDLE_STORE_NAME);
                }
            };
        });
        return _dbPromise;
    };

    const _storeHandleInDB = async (handle) => {
        if (!handle) return;
        try {
            const db = await _openDB();
            const transaction = db.transaction(HANDLE_STORE_NAME, 'readwrite');
            const store = transaction.objectStore(HANDLE_STORE_NAME);
            store.put(handle, HANDLE_KEY); // Store the handle with the fixed key
            await new Promise((resolve, reject) => { // Wait for transaction completion
                 transaction.oncomplete = () => {
                     console.log("Directory handle stored in IndexedDB.");
                     resolve();
                 };
                 transaction.onerror = () => reject(transaction.error);
            });
        } catch (error) {
            console.error("Error storing handle in IndexedDB:", error);
        }
    };

    const _getHandleFromDB = async () => {
        try {
            const db = await _openDB();
            const transaction = db.transaction(HANDLE_STORE_NAME, 'readonly');
            const store = transaction.objectStore(HANDLE_STORE_NAME);
            const request = store.get(HANDLE_KEY); // Get handle by fixed key

            return await new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    console.log("Handle retrieved from IndexedDB:", request.result ? 'Found' : 'Not Found');
                    resolve(request.result); // Returns the handle or undefined
                };
                request.onerror = () => {
                    console.error("Error getting handle from IndexedDB:", request.error);
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error("Error accessing IndexedDB to get handle:", error);
            return undefined; // Return undefined on DB access error
        }
    };

    const _deleteHandleFromDB = async () => {
         try {
            const db = await _openDB();
            const transaction = db.transaction(HANDLE_STORE_NAME, 'readwrite');
            const store = transaction.objectStore(HANDLE_STORE_NAME);
            store.delete(HANDLE_KEY);
            await new Promise((resolve, reject) => {
                 transaction.oncomplete = () => {
                     console.log("Handle deleted from IndexedDB.");
                     resolve();
                 };
                 transaction.onerror = () => reject(transaction.error);
            });
        } catch (error) {
            console.error("Error deleting handle from IndexedDB:", error);
        }
    };


    // --- Private Helper Functions (Existing) ---
    // Loads the bank from Local Storage (REVISED FOR ROBUSTNESS)
    const _loadBank = () => {
        let bank = []; // Default to an empty array
        try {
            const storedData = localStorage.getItem(STORAGE_KEY);
            if (storedData) {
                // Check if the stored string is literally "undefined"
                if (storedData === "undefined") {
                    console.warn(`localStorage key ${STORAGE_KEY} contained the string "undefined". Resetting.`);
                    localStorage.removeItem(STORAGE_KEY);
                    // Keep bank as []
                } else {
                    const parsedData = JSON.parse(storedData);
                    // Ensure the parsed data is actually an array
                    if (Array.isArray(parsedData)) {
                        bank = parsedData;
                    } else {
                        console.warn(`Data loaded from localStorage for key ${STORAGE_KEY} was not an array after parsing. Resetting. Type: ${typeof parsedData}, Value:`, parsedData);
                        localStorage.removeItem(STORAGE_KEY); // Remove invalid data
                        // Keep bank as []
                    }
                }
            }
            // If storedData was null or empty, bank remains []
        } catch (error) {
            console.error("Error loading/parsing memory bank metadata from Local Storage:", error);
            // Attempt to clear potentially corrupted data
            try {
                localStorage.removeItem(STORAGE_KEY);
            } catch (removeError) {
                console.error("Failed to remove corrupted item from localStorage:", removeError);
            }
            // Keep bank as []
        }
        // Ensure we always return an array
        return Array.isArray(bank) ? bank : [];
    };

    // Saves the bank to Local Storage
    const _saveBank = (bank) => {
        try {
            // Add a check to prevent saving undefined
            if (typeof bank === 'undefined') {
                console.error("Attempted to save 'undefined' to memory bank. Aborting save.");
                return;
            }
            localStorage.setItem(STORAGE_KEY, JSON.stringify(bank));
        } catch (error) {
            console.error("Error saving memory bank metadata to Local Storage:", error);
            // Consider notifying the user if storage is full
        }
    };

    // Generates a UUID
    const _generateUUID = () => {
        // (UUID generation code remains the same)
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        } else {
            console.warn("crypto.randomUUID not available, using fallback.");
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        }
    };

    // --- File System Access API Helpers ---

    const _getPixelDataFileName = (id, type) => `${id}-${type}.bin`;

    // Saves pixel data (ArrayBuffer) to a file using FSA API (ADDED LOGGING)
    const _savePixelData = async (id, type, arrayBuffer, width, height) => {
        console.log(`_savePixelData: Called for ID=${id}, Type=${type}, Width=${width}, Height=${height}`); // Log Entry
        if (!_directoryHandle) {
            console.error(`_savePixelData: FAILED - Directory handle is null for ID=${id}, Type=${type}`);
            return null;
        }
        // Log data type and size for validation check
        const isBuffer = arrayBuffer instanceof ArrayBuffer;
        const bufferSize = arrayBuffer?.byteLength ?? 'N/A';
        console.log(`_savePixelData: Validating data for ID=${id}, Type=${type}. Is ArrayBuffer: ${isBuffer}, Size: ${bufferSize}`);

        if (!arrayBuffer || !isBuffer || !width || !height) {
             console.error(`_savePixelData: FAILED - Invalid data provided for ID=${id}, Type=${type}. BufferValid: ${isBuffer}, W: ${width}, H: ${height}`);
             return null;
        }

        const fileName = _getPixelDataFileName(id, type);
        console.log(`_savePixelData: Attempting to save file: ${fileName}`); // Log before try
        try {
            const fileHandle = await _directoryHandle.getFileHandle(fileName, { create: true });
            console.log(`_savePixelData: Got file handle for ${fileName}`); // Log after getFileHandle
            const writable = await fileHandle.createWritable();
            console.log(`_savePixelData: Created writable stream for ${fileName}`); // Log after createWritable

            const header = new ArrayBuffer(8);
            const dataView = new DataView(header);
            dataView.setUint32(0, width, true);
            dataView.setUint32(4, height, true);

            console.log(`_savePixelData: Writing header to ${fileName}...`); // Log before write
            await writable.write(header);
            console.log(`_savePixelData: Writing pixel data (${bufferSize} bytes) to ${fileName}...`); // Log before write
            await writable.write(arrayBuffer);
            console.log(`_savePixelData: Closing file ${fileName}...`); // Log before close
            await writable.close();

            console.log(`_savePixelData: SUCCESS - Saved ${fileName}`); // Log Success
            return fileName;
        } catch (error) {
            console.error(`_savePixelData: FAILED - Error saving file ${fileName}:`, error); // Log Error in Catch
            try {
                await _directoryHandle.removeEntry(fileName);
                console.warn(`_savePixelData: Attempted cleanup of failed save: ${fileName}`);
            } catch (cleanupError) {
                // Ignore cleanup errors
            }
            return null;
        }
    };


    // Deletes pixel data files associated with a record ID
    const _deletePixelData = async (id) => {
        if (!_directoryHandle) {
            console.warn("Cannot delete pixel data: Directory permission not granted or handle lost.");
            return false;
        }
        if (!id) return false;

        let deletedRender = false;
        let deletedPaint = false;
        const renderFileName = _getPixelDataFileName(id, 'render');
        const paintFileName = _getPixelDataFileName(id, 'paint');

        try {
            await _directoryHandle.removeEntry(renderFileName);
            console.log(`Pixel data file deleted: ${renderFileName}`);
            deletedRender = true;
        } catch (error) {
            if (error.name !== 'NotFoundError') {
                console.error(`Error deleting pixel data file ${renderFileName}:`, error);
            } else {
                 deletedRender = true;
            }
        }
        try {
            await _directoryHandle.removeEntry(paintFileName);
            console.log(`Pixel data file deleted: ${paintFileName}`);
            deletedPaint = true;
        } catch (error) {
             if (error.name !== 'NotFoundError') {
                console.error(`Error deleting pixel data file ${paintFileName}:`, error);
            } else {
                deletedPaint = true;
            }
        }
        return deletedRender && deletedPaint;
    };

    // Retrieves pixel data (as { arrayBuffer, width, height }) from a file
    const _getPixelDataInternal = async (fileName) => {
         if (!_directoryHandle) {
            console.error("Cannot get pixel data: Directory permission not granted or handle lost.");
            return null;
        }
        if (!fileName) return null;

        try {
            const fileHandle = await _directoryHandle.getFileHandle(fileName);
            const file = await fileHandle.getFile();
            const fullBuffer = await file.arrayBuffer();

            if (fullBuffer.byteLength < 8) {
                console.error(`File ${fileName} is too small to contain header.`);
                return null;
            }

            const dataView = new DataView(fullBuffer, 0, 8);
            const width = dataView.getUint32(0, true);
            const height = dataView.getUint32(4, true);
            const pixelDataBuffer = fullBuffer.slice(8);
            const expectedBytes = width * height * 4;
             if (pixelDataBuffer.byteLength !== expectedBytes) {
                 console.warn(`Pixel data size mismatch for ${fileName}. Expected ${expectedBytes}, got ${pixelDataBuffer.byteLength}. Returning data anyway.`);
             }

            return { arrayBuffer: pixelDataBuffer, width, height };
        } catch (error) {
            if (error.name === 'NotFoundError') {
                console.warn(`Pixel data file not found: ${fileName}`);
            } else {
                console.error(`Error reading pixel data file ${fileName}:`, error);
            }
            return null;
        }
    };


    // --- Initialization / Cleanup Logic ---
    const _performCleanup = async () => {
        if (_initialCleanupPerformed) {
            return;
        }
        if (!_directoryHandle) {
            console.warn("Cleanup deferred: Directory permission not yet granted.");
            return;
        }

        console.log("Performing initial Memory Bank cleanup (saveState=false)...");
        let bank = _loadBank();

        if (!Array.isArray(bank)) {
             console.error("_loadBank unexpectedly returned non-array. Aborting cleanup.", bank);
             localStorage.removeItem(STORAGE_KEY);
             _initialCleanupPerformed = true;
             return;
        }

        const initialCount = bank.length;
        let recordsToDelete = [];
        let recordsToKeep = [];

        bank.forEach(record => {
            if (record && record.saveState === false) {
                recordsToDelete.push(record.id);
            } else {
                recordsToKeep.push(record);
            }
        });

        if (recordsToDelete.length > 0) {
            console.log(`Found ${recordsToDelete.length} records with saveState=false. Attempting deletion...`);

            let deletePromises = recordsToDelete.map(id =>
                _deletePixelData(id).catch(err => {
                    console.error(`Cleanup Error: Failed deleting pixel data for ID ${id}:`, err);
                    return false;
                })
            );

            const results = await Promise.all(deletePromises);
            const successfulDeletions = results.filter(r => r).length;
            const failedDeletions = recordsToDelete.length - successfulDeletions;
            console.log(`Pixel data deletion attempts completed. Success: ${successfulDeletions}, Failed: ${failedDeletions}`);

            _saveBank(recordsToKeep);
            console.log(`Removed ${recordsToDelete.length} metadata records. ${recordsToKeep.length} records remain.`);

        } else {
            console.log("No records found with saveState=false. No cleanup needed.");
        }

        _initialCleanupPerformed = true;
    };


    // --- Public API ---

    const requestDirectoryPermission = async () => {
        console.log("requestDirectoryPermission: Function started."); // LOG 1
        _directoryHandle = null;
        _initialCleanupPerformed = false;

        if (!window.showDirectoryPicker) {
            console.error("requestDirectoryPermission: File System Access API (showDirectoryPicker) is not supported."); // LOG 2 (Error)
            alert("Error: File System Access API is not available. Cannot save pixel data.");
            return false;
        }
        try {
            console.log("requestDirectoryPermission: Requesting directory picker..."); // LOG 3
            const topLevelHandle = await window.showDirectoryPicker({
                id: STORAGE_KEY,
                mode: 'readwrite',
                startIn: 'pictures'
            });
            console.log("requestDirectoryPermission: Directory picker returned handle:", topLevelHandle?.name); // LOG 4

            console.log("requestDirectoryPermission: Requesting subdirectory handle..."); // LOG 5
            const subDirHandle = await topLevelHandle.getDirectoryHandle(PIXEL_DATA_DIR_NAME, { create: true });
            console.log(`requestDirectoryPermission: Subdirectory handle obtained: '${subDirHandle?.name}'`); // LOG 6

            // *** Assign and Store Handle ***
            _directoryHandle = subDirHandle; // Assign to in-memory variable
            await _storeHandleInDB(_directoryHandle); // Store in IndexedDB

            // *** ISOLATE CLEANUP CALL ***
            try {
                 console.log("requestDirectoryPermission: Calling _performCleanup..."); // LOG 7
                 await _performCleanup();
                 console.log("requestDirectoryPermission: _performCleanup completed."); // LOG 8
            } catch (cleanupError) {
                 console.error("requestDirectoryPermission: Error occurred *during* _performCleanup call:", cleanupError); // LOG 9 (Error)
                 _directoryHandle = null; // Clear handle if cleanup failed critically
                 return false;
            }
            // *** END ISOLATED CLEANUP ***

            console.log("requestDirectoryPermission: Returning true (Permission granted, handle stored, cleanup attempted)."); // LOG 10
            return true;

        } catch (error) {
            // This catch block handles errors from showDirectoryPicker or getDirectoryHandle
            if (error.name === 'AbortError') {
                console.warn("requestDirectoryPermission: User aborted directory selection."); // LOG 11 (Warn)
            } else {
                console.error("requestDirectoryPermission: Error during picker/handle acquisition:", error); // LOG 12 (Error)
            }
            _directoryHandle = null;
            _initialCleanupPerformed = false;
            console.log("requestDirectoryPermission: Returning false due to error during acquisition or abort."); // LOG 13
            return false;
        }
    };

    const hasDirectoryPermission = () => {
        return _directoryHandle !== null;
    };

    /**
     * Adds a new render record metadata to Local Storage and saves pixel data to files.
     * (ADDED LOGGING)
     * @param {object} recordData - Object containing data.
     * Expected fields: distribution, shape, category, sampling, scale,
     *                  renderPixelData (ArrayBuffer), renderWidth, renderHeight,
     *                  paintPixelData (ArrayBuffer), paintWidth, paintHeight.
     * Optional fields: name, likes, time, saveState (defaults to false).
     * @returns {Promise<object | null>} The newly created record metadata object, or null on error.
     */
    const addRecord = async (recordData) => {
        console.log("addRecord: Function started."); // Log Entry
        if (!recordData || typeof recordData !== 'object') {
            console.error("addRecord: FAILED - Invalid recordData provided.");
            return null;
        }
        if (!_directoryHandle) {
             console.error("addRecord: FAILED - Directory handle is null.");
             // alert("Error: Please grant directory permission first to save the record."); // Maybe remove alert
             return null;
        }
         if (!recordData.renderPixelData || !recordData.paintPixelData) {
             console.error("addRecord: FAILED - Missing pixel data in recordData.");
             return null;
         }

        const bank = _loadBank();
        const recordId = _generateUUID();
        console.log(`addRecord: Generated ID: ${recordId}`); // Log ID

        let renderFileName = null;
        let paintFileName = null;
        let success = false;

        try {
            // 1. Attempt to save pixel data first
            console.log(`addRecord: Calling _savePixelData for render (ID: ${recordId})`); // Log before render save
            renderFileName = await _savePixelData(recordId, 'render', recordData.renderPixelData, recordData.renderWidth, recordData.renderHeight);
            console.log(`addRecord: _savePixelData for render returned: ${renderFileName}`); // Log after render save

            if (renderFileName) {
                console.log(`addRecord: Calling _savePixelData for paint (ID: ${recordId})`); // Log before paint save
                paintFileName = await _savePixelData(recordId, 'paint', recordData.paintPixelData, recordData.paintWidth, recordData.paintHeight);
                console.log(`addRecord: _savePixelData for paint returned: ${paintFileName}`); // Log after paint save
            }

            // 2. If pixel data saving failed, abort adding the record
            if (!renderFileName || !paintFileName) {
                console.error(`addRecord: FAILED - Pixel data saving failed. Render file: ${renderFileName}, Paint file: ${paintFileName}. Aborting.`);
                // Attempt cleanup only if at least one file might have been created
                if (renderFileName || paintFileName) {
                     console.log(`addRecord: Attempting cleanup for failed save (ID: ${recordId})`);
                     await _deletePixelData(recordId);
                }
                success = false; // Explicitly mark as failed
            } else {
                // 3. Create and save metadata record (only if both files saved)
                console.log(`addRecord: Both pixel files saved. Creating metadata record (ID: ${recordId})`);
                const newRecord = {
                    distribution: recordData.distribution ?? null,
                    shape: recordData.shape ?? {},
                    category: Array.isArray(recordData.category) ? recordData.category : [recordData.shape?.type ?? 'unknown'],
                    sampling: recordData.sampling ?? 'unknown',
                    scale: recordData.scale ?? 1,
                    name: recordData.name ?? "",
                    likes: recordData.likes ?? 0,
                    time: recordData.time ?? new Date().toISOString(),
                    id: recordId,
                    saveState: recordData.saveState ?? false,
                    render: renderFileName,
                    paint: paintFileName,
                    renderWidth: recordData.renderWidth,
                    renderHeight: recordData.renderHeight,
                    paintWidth: recordData.paintWidth,
                    paintHeight: recordData.paintHeight,
                };

                bank.push(newRecord);
                _saveBank(bank);
                console.log(`addRecord: SUCCESS - Record metadata added (ID: ${recordId})`);
                success = true; // Mark as success
                return newRecord; // Return the metadata object on success
            }

        } catch (error) {
             console.error(`addRecord: FAILED - Unexpected error during addRecord process (ID: ${recordId}):`, error);
             success = false; // Mark as failed
             // Attempt cleanup just in case something partially succeeded before the error
             console.log(`addRecord: Attempting cleanup after unexpected error (ID: ${recordId})`);
             await _deletePixelData(recordId);
        }

        // Return null explicitly if any failure path was taken that didn't already return
        if (!success) {
             console.log(`addRecord: Returning null due to failure (ID: ${recordId})`);
             return null;
        }
        // This part should technically be unreachable if logic is correct
        return null;
    };


    const getRecordById = (id) => {
        const bank = _loadBank();
        return bank.find(record => record && record.id === id);
    };

    const getPixelData = async (id, type) => {
         if (type !== 'render' && type !== 'paint') {
             console.error("getPixelData: type must be 'render' or 'paint'");
             return null;
         }
         const record = getRecordById(id);
         if (!record) {
             console.error(`getPixelData: Record with ID ${id} not found.`);
             return null;
         }
         const fileName = record[type];
         if (!fileName) {
              console.error(`getPixelData: No ${type} filename found for record ${id}.`);
              return null;
         }
         return await _getPixelDataInternal(fileName);
    };

    const findRecords = (criteria) => {
        const bank = _loadBank();
        if (!criteria || Object.keys(criteria).length === 0) {
            return bank.filter(record => !!record);
        }

        return bank.filter(record => {
            if (!record) return false;

            return Object.keys(criteria).every(key => {
                if (key === 'render' || key === 'paint' || key.endsWith('PixelData') || key.endsWith('Width') || key.endsWith('Height')) return true;
                if (!(key in record)) return false;
                const criterionValue = criteria[key];
                const recordValue = record[key];
                if (key === 'category' && Array.isArray(criterionValue) && Array.isArray(recordValue)) {
                    return criterionValue.every(cat => recordValue.includes(cat));
                } else if (key === 'category' && !Array.isArray(criterionValue) && Array.isArray(recordValue)) {
                    return recordValue.includes(criterionValue);
                } else if (typeof criterionValue === 'object' && criterionValue !== null && typeof recordValue === 'object' && recordValue !== null) {
                    return Object.keys(criterionValue).every(subKey =>
                        criterionValue[subKey] === recordValue[subKey]
                    );
                } else {
                    return recordValue === criterionValue;
                }
            });
        });
    };

    const updateRecord = (id, updates) => {
        if (!id || !updates || typeof updates !== 'object') {
            console.error("updateRecord: Invalid id or updates provided.");
            return false;
        }
        const bank = _loadBank();
        const recordIndex = bank.findIndex(record => record && record.id === id);

        if (recordIndex === -1) {
            console.warn(`updateRecord: Record metadata with ID ${id} not found.`);
            return false;
        }
        const allowedUpdates = ['name', 'likes', 'category', 'time', 'saveState'];
        let updated = false;
        const recordToUpdate = bank[recordIndex];

        allowedUpdates.forEach(key => {
            if (key in updates) {
                if (key === 'category' && !Array.isArray(updates[key])) {
                    console.warn(`updateRecord: Category update for ID ${id} must be an array.`);
                } else if (key === 'saveState' && typeof updates[key] !== 'boolean') {
                     console.warn(`updateRecord: saveState update for ID ${id} must be a boolean.`);
                } else if (recordToUpdate[key] !== updates[key]) {
                    recordToUpdate[key] = updates[key];
                    updated = true;
                }
            }
        });

        if (updated) {
            _saveBank(bank);
            console.log(`Record metadata updated for ID: ${id}`);
        } else {
            console.log(`No valid or changed fields to update for ID: ${id}`);
        }
        return updated;
    };

    const deleteRecord = async (id) => {
        const bank = _loadBank();
        const recordIndex = bank.findIndex(record => record && record.id === id);

        if (recordIndex === -1) {
            console.warn(`deleteRecord: Record metadata with ID ${id} not found.`);
            return false;
        }
        let fileDeleteSuccess = true;
        if (_directoryHandle) {
            fileDeleteSuccess = await _deletePixelData(id).catch(err => {
                console.error(`deleteRecord: Error during pixel data deletion for ID ${id}:`, err);
                return false;
            });
            if (!fileDeleteSuccess) {
                 console.warn(`deleteRecord: Issue occurred during pixel data file deletion for ID ${id} (files might remain). Metadata will still be removed.`);
            }
        } else {
             console.warn(`deleteRecord: Cannot delete pixel data files for ID ${id} (no directory permission this session). Metadata will still be removed.`);
        }
        const newBank = bank.filter(record => record && record.id !== id);
        _saveBank(newBank);
        console.log(`Record metadata deleted for ID: ${id}. File deletion attempted: ${fileDeleteSuccess ? 'Success/Not Needed' : 'Failed'}.`);
        return true;
    };

    const getAllRecords = () => {
        return _loadBank().filter(record => !!record);
    };


    // --- Module Initialization ---

    const tryInitializePermission = async () => {
        console.log("Attempting to initialize FSA permission from IndexedDB...");
        const storedHandle = await _getHandleFromDB();

        if (storedHandle) {
            console.log("Found stored handle. Verifying permission...");
            try {
                const permissionState = await storedHandle.requestPermission({ mode: 'readwrite' });
                if (permissionState === 'granted') {
                    console.log("Permission verified and granted for stored handle.");
                    _directoryHandle = storedHandle;
                    await _performCleanup();
                    return true;
                } else {
                    console.warn(`Permission for stored handle is '${permissionState}'. Removing stored handle.`);
                    await _deleteHandleFromDB();
                    _directoryHandle = null;
                    _initialCleanupPerformed = false;
                    return false;
                }
            } catch (verifyError) {
                 console.error("Error verifying permission for stored handle:", verifyError);
                 await _deleteHandleFromDB();
                 _directoryHandle = null;
                 _initialCleanupPerformed = false;
                 return false;
            }
        } else {
            console.log("No stored handle found in IndexedDB.");
            return false;
        }
    };

    console.log("Memory Bank module loaded. Attempting permission initialization...");
    // Initialization is now triggered by script.js after module load

    // Expose public functions
    return {
        requestDirectoryPermission,
        hasDirectoryPermission,
        tryInitializePermission, // Expose the initialization function
        addRecord,
        getRecordById,
        getPixelData,
        findRecords,
        updateRecord,
        deleteRecord,
        getAllRecords
    };
})();

// --- END OF FILE memoryBank.js ---