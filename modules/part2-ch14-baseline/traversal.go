package baseline

import (
	"io"
	"os"
	"path/filepath"
)

// ReadUnsafe joins the base and the caller's name and reads the result.
func ReadUnsafe(base, name string) ([]byte, error) {
	return os.ReadFile(filepath.Join(base, name))
}

// ReadSafe opens the file through an os.Root: the kernel refuses any path, including one that
// goes through a symlink, that leaves the base directory.
func ReadSafe(base, name string) ([]byte, error) {
	root, err := os.OpenRoot(base)
	if err != nil {
		return nil, err
	}
	defer root.Close()
	f, err := root.Open(name)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	return io.ReadAll(f)
}
