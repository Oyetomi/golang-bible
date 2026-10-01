package purge

import (
	"context"
	"testing"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
	"go.uber.org/mock/gomock"
)

func objs(keys ...string) []types.Object {
	o := make([]types.Object, len(keys))
	for i, k := range keys {
		o[i] = types.Object{Key: aws.String(k)}
	}
	return o
}

// The mock encodes the author's belief about S3. Case 1 is the belief most
// people write first (one page). Case 2 only exists if you already know S3
// paginates.
func TestPrefix_Mock(t *testing.T) {
	cases := []struct {
		name  string
		setup func(m *MockS3)
		want  int
	}{
		{"one page of three", func(m *MockS3) {
			m.EXPECT().ListObjectsV2(gomock.Any(), gomock.Any()).Return(&s3.ListObjectsV2Output{Contents: objs("a", "b", "c")}, nil)
			m.EXPECT().DeleteObjects(gomock.Any(), gomock.Any()).Return(&s3.DeleteObjectsOutput{}, nil)
		}, 3},
		{"two scripted pages", func(m *MockS3) {
			gomock.InOrder(
				m.EXPECT().ListObjectsV2(gomock.Any(), gomock.Any()).Return(&s3.ListObjectsV2Output{Contents: objs("a", "b"), IsTruncated: aws.Bool(true), NextContinuationToken: aws.String("t1")}, nil),
				m.EXPECT().DeleteObjects(gomock.Any(), gomock.Any()).Return(&s3.DeleteObjectsOutput{}, nil),
				m.EXPECT().ListObjectsV2(gomock.Any(), gomock.Any()).Return(&s3.ListObjectsV2Output{Contents: objs("c")}, nil),
				m.EXPECT().DeleteObjects(gomock.Any(), gomock.Any()).Return(&s3.DeleteObjectsOutput{}, nil),
			)
		}, 3},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			ctrl := gomock.NewController(t)
			m := NewMockS3(ctrl)
			tc.setup(m)
			got, err := Prefix(context.Background(), m, "b", "p/")
			if err != nil {
				t.Fatal(err)
			}
			if got != tc.want {
				t.Errorf("deleted = %d, want %d", got, tc.want)
			}
		})
	}
}

